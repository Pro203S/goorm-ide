import * as vscode from 'vscode';
import TreeDataProvider from './classes/TreeDataProvider';
import AuthenticationProvider from './classes/AuthenticationProvider';
import TreeViewItem from './classes/TreeViewItem';
import getInitialState from './modules/getInitialState';
import axios from 'axios';
import { stringifyCookie } from 'cookie';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { WebviewProvider } from './classes/WebviewProvider';
import sanitizeFileName from './modules/sanitizeFileName';
import getHTML from './modules/getHTML';
import SocketIO from './modules/SocketIO';
import DebugSocket from './modules/DebugSocket';
import DebugTerminal from './classes/DebugTerminal';

axios.interceptors.request.use((config) => {
    config.headers.set({
        ...config.headers,
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "accept-language": "en-US,en;q=0.9,ko-KR;q=0.8,ko;q=0.7,ja-JP;q=0.6,ja;q=0.5",
        "cache-control": "no-cache",
        "pragma": "no-cache",
        "priority": "u=0, i",
        "sec-ch-ua": "\"Chromium\";v=\"146\", \"Not-A.Brand\";v=\"24\", \"Google Chrome\";v=\"146\"",
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": "\"Windows\"",
        "sec-fetch-dest": "document",
        "sec-fetch-mode": "navigate",
        "sec-fetch-site": "none",
        "sec-fetch-user": "?1",
        "upgrade-insecure-requests": "1",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
    });
    config.withCredentials = true;
    return config;
});

axios.interceptors.response.use((config) => {
    console.log("[goormEdu]", config.config.method ?? "get", config.config.url, config.status);
    return config;
});

let loggedIn: boolean = false;
let goormTemp: string = path.join(os.tmpdir(), "goorm-ide");
let selectedLectureIndex: string | undefined = undefined;
let currentQuizUrl: string | undefined = undefined;
let currentProject: APIWorkspaceLesson["result"]["project"][string] | undefined = undefined;
let quizSocket: SocketIO | undefined = undefined;
let debugSocket: DebugSocket | undefined = undefined;
let changeSelectionEvent: vscode.Disposable | undefined = undefined;
let changeSelection: TreeViewItem | undefined = undefined;
let currentTerminal: vscode.Terminal | undefined = undefined;
let currentTerminalProvider: DebugTerminal | undefined = undefined;
let currentTerminalDisposable: vscode.Disposable | undefined = undefined;

export async function activate(context: vscode.ExtensionContext) {
    if (!fs.existsSync(goormTemp))
        fs.mkdirSync(goormTemp);

    const treeProvider = new TreeDataProvider();
    const treeView = vscode.window.createTreeView("goormTree", {
        treeDataProvider: treeProvider
    });
    context.subscriptions.push(treeView);

    changeSelectionEvent = treeView.onDidChangeSelection((e) => {
        changeSelection = e.selection[0];
    });

    const authProvider = new AuthenticationProvider("https://sunrint-hs.goorm.io");
    context.subscriptions.push(
        vscode.authentication.registerAuthenticationProvider("goormIde", "구름EDU", authProvider, { "supportsMultipleAccounts": false })
    );

    const webviewProvider = new WebviewProvider(context);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider("goormDesc", webviewProvider)
    );

    const restoreSession = async () => {
        try {
            const rawSession = await context.secrets.get("session");
            const goormUrl = await context.secrets.get("goormUrl");

            if (!rawSession || !goormUrl) return;

            const session: vscode.AuthenticationSession = JSON.parse(rawSession);

            const r = await getInitialState(goormUrl, JSON.parse(session.accessToken));

            loggedIn = true;
            treeProvider.addItem(new TreeViewItem({
                "id": "sessionState",
                "label": "현재 계정: " + r.userData.name,
                "collapsibleState": vscode.TreeItemCollapsibleState.None,
                "icon": new vscode.ThemeIcon("account"),
                "contextValue": "sessionState"
            }));
        } catch (err) {
            const e = err as Error;
            vscode.window.showErrorMessage("구름EDU: " + e.message + "\n재로그인 해주세요.");
        }
    };

    // 명령어 푸시
    context.subscriptions.push(
        vscode.commands.registerCommand("goorm-ide.firstRun", async () => {
            try {
                const url = await vscode.window.showInputBox({
                    "placeHolder": "구름EDU 사이트 URL을 입력해주세요. (예시: https://sunrint-hs.goorm.io)",
                    "validateInput": (v) => {
                        try {
                            new URL(v);
                            if (!v.endsWith("goorm.io"))
                                throw new Error();

                            return null;
                        } catch {
                            return "URL이 잘못되었습니다.";
                        }
                    }
                });
                if (!url) return;

                authProvider.goormUrl = url;
                const session = await authProvider.createSession();

                await context.secrets.store("session", JSON.stringify(session));
                await context.secrets.store("goormUrl", url);

                await restoreSession();
                vscode.window.showInformationMessage("구름EDU에 로그인되었습니다.");
            } catch (err) {
                const e = err as Error;
                vscode.window.showErrorMessage("구름EDU: " + e.message);
            }
        }),
        vscode.commands.registerCommand("goorm-ide.login", async () => {
            try {
                if (!await context.secrets.get("goormUrl"))
                    throw new Error("구름 URL이 설정되지 않았어요.");

                const sessions = await authProvider.getSessions();
                if (sessions[0])
                    await authProvider.removeSession(sessions[0].id);

                const session = await authProvider.createSession();

                await context.secrets.store("session", JSON.stringify(session));

                await restoreSession();
                vscode.window.showInformationMessage("구름EDU에 로그인되었습니다.");
            } catch (err) {
                const e = err as Error;
                vscode.window.showErrorMessage("구름EDU: " + e.message);
            }
        }),
        vscode.commands.registerCommand("goorm-ide.logout", async () => {
            try {
                if (!await context.secrets.get("goormUrl"))
                    throw new Error("구름 URL이 설정되지 않았어요.");

                const sessions = await authProvider.getSessions();
                if (sessions[0])
                    await authProvider.removeSession(sessions[0].id);

                await context.secrets.delete("session");

                for await (const item of await treeProvider.getChildren()) {
                    treeProvider.removeItem(item.id);
                }
                webviewProvider.setHTML("");

                vscode.window.showInformationMessage("구름EDU에서 로그아웃되었습니다.");
            } catch (err) {
                const e = err as Error;
                vscode.window.showErrorMessage("구름EDU: " + e.message);
            }
        }),
        vscode.commands.registerCommand("goorm-ide.attendance", async () => {
            try {
                if (!loggedIn)
                    throw new Error("로그인해주세요!");

                const rawSession = await context.secrets.get("session");
                const goormUrl = await context.secrets.get("goormUrl");

                if (!rawSession || !goormUrl) {
                    for await (const item of await treeProvider.getChildren()) {
                        treeProvider.removeItem(item.id);
                    }
                    throw new Error("재로그인해주세요!");
                }

                if (!selectedLectureIndex) throw new Error("수업을 선택해주세요!");

                const session: vscode.AuthenticationSession = JSON.parse(rawSession);

                const r = await axios.post(`${goormUrl}/api/lecture/${selectedLectureIndex}/always-attendance/attendance`, {}, {
                    "headers": {
                        "cookie": stringifyCookie(JSON.parse(session.accessToken)),
                        "Content-Type": "application/json"
                    },
                    "withCredentials": true,
                    "validateStatus": () => true
                });
                if (r.status !== 200) {
                    if (r.status === 403) {
                        vscode.window.showInformationMessage("이미 출석했어요.");
                        return;
                    }

                    if (r.status === 401) {
                        for await (const item of await treeProvider.getChildren()) {
                            treeProvider.removeItem(item.id);
                        }
                        throw new Error("재로그인해주세요!");
                    }

                    throw new Error("Request failed with status code " + r.status);
                }

                vscode.window.showInformationMessage("현재 수업에 출석했어요.");
            } catch (err) {
                const e = err as Error;
                vscode.window.showErrorMessage("구름EDU: " + e.message);
            }
        }),
        vscode.commands.registerCommand("goorm-ide.selectLearn", async (seq?: number) => {
            try {
                if (!loggedIn)
                    throw new Error("로그인해주세요!");

                const rawSession = await context.secrets.get("session");
                const goormUrl = await context.secrets.get("goormUrl");

                if (!rawSession || !goormUrl) {
                    for await (const item of await treeProvider.getChildren()) {
                        treeProvider.removeItem(item.id);
                    }
                    throw new Error("재로그인해주세요!");
                }

                const session: vscode.AuthenticationSession = JSON.parse(rawSession);

                const initialState = await getInitialState(goormUrl, JSON.parse(session.accessToken));
                const list = initialState.channelLectureList.allLectures;

                let sequence = seq;

                if (!sequence) {
                    const lectureId = await vscode.window.showQuickPick(
                        list.map(v => ({
                            "label": v.subject,
                            "value": v.sequence,
                            "description": v.description
                        })),
                        {
                            "canPickMany": false,
                            "placeHolder": "수업 선택",
                            "title": "구름EDU"
                        }
                    );
                    if (!lectureId) return;

                    sequence = lectureId.value;
                }

                const r = await axios.get<APILearn>("https://sunrint-hs.goorm.io/api/learn", {
                    "headers": {
                        "cookie": stringifyCookie(JSON.parse(session.accessToken))
                    },
                    "withCredentials": true,
                    "params": {
                        sequence
                    }
                });

                for await (const item of await treeProvider.getChildren()) {
                    if (item.id === "sessionState") continue;
                    treeProvider.removeItem(item.id);
                }

                const curriculumData = r.data.curriculumData;
                selectedLectureIndex = r.data.index;

                treeProvider.addItem(new TreeViewItem({
                    "id": "current-learn",
                    "icon": new vscode.ThemeIcon("book"),
                    "collapsibleState": vscode.TreeItemCollapsibleState.None,
                    "label": r.data.subject,
                }));

                for (const curriculum of curriculumData) {
                    const item = new TreeViewItem({
                        "id": curriculum.index,
                        "label": curriculum.name,
                        "collapsibleState": vscode.TreeItemCollapsibleState.Collapsed,
                        "icon": curriculum.allLessons === curriculum.completedLessons ? new vscode.ThemeIcon("check") : new vscode.ThemeIcon("folder-library")
                    });
                    treeProvider.addItem(item);
                    for (const lesson of curriculum.lessons) {
                        treeProvider.addChildren(item.id, new TreeViewItem({
                            "id": lesson.index,
                            "label": lesson.name,
                            "collapsibleState": vscode.TreeItemCollapsibleState.None,
                            "icon": (() => {
                                if (lesson.score === 100) return new vscode.ThemeIcon("check");

                                switch (lesson.type) {
                                    case 'contents': return new vscode.ThemeIcon("three-bars");
                                    default: return new vscode.ThemeIcon("file-code");
                                }
                            })(),
                            "onClick": {
                                "title": lesson.name + " 문제 풀기",
                                "command": "goorm-ide.showQuiz",
                                "arguments": [
                                    curriculum.index,
                                    lesson.index,
                                    curriculum.name + " " + lesson.name,
                                    sequence,
                                    lesson.name
                                ]
                            }
                        }));
                    }
                }
            } catch (err) {
                const e = err as Error;
                vscode.window.showErrorMessage("구름EDU: " + e.message);
            }
        }),
        vscode.commands.registerCommand("goorm-ide.showQuiz", async (lectureIndex: string, lessonIndex: string, name: string, sequence: number, label: string) => {
            try {
                await vscode.window.withProgress({
                    "title": "과제 불러오는 중...",
                    "location": vscode.ProgressLocation.Notification,
                    "cancellable": false
                }, async () => {
                    if (!loggedIn) return Promise.reject(new Error("로그인해주세요!"));

                    const rawSession = await context.secrets.get("session");
                    const goormUrl = await context.secrets.get("goormUrl");

                    if (!rawSession || !goormUrl) {
                        for await (const item of await treeProvider.getChildren()) {
                            treeProvider.removeItem(item.id);
                        }
                        return Promise.reject(new Error("재로그인해주세요!"));
                    }

                    const session: vscode.AuthenticationSession = JSON.parse(rawSession);

                    if (quizSocket) {
                        quizSocket.close();
                    }

                    const r = await axios.get<APIWorkspaceLesson>("https://sunrint-hs.goorm.io/api/workspace/lesson", {
                        "withCredentials": true,
                        "headers": {
                            "cookie": stringifyCookie(JSON.parse(session.accessToken))
                        },
                        "params": {
                            lectureIndex,
                            lessonIndex
                        }
                    });
                    const projects = Object.keys(r.data.result.project);
                    const project = r.data.result.project[projects[0]];
                    const file = project.files[0];
                    const content = file.content[0].source;
                    currentProject = project;

                    vscode.commands.executeCommand(
                        "setContext",
                        "goorm-ide.isEditingSource",
                        true
                    );

                    const filePath = path.join(goormTemp, sanitizeFileName(name) + ".c");
                    const uri = vscode.Uri.parse((process.platform === "win32" ? "file:///" : "") + filePath + "?goorm");
                    fs.writeFileSync(filePath, content, "utf-8");

                    const doc = await vscode.workspace.openTextDocument(uri);

                    const lecture = (await getInitialState(goormUrl, JSON.parse(session.accessToken))).channelLectureList.allLectures.find(v => v.sequence === sequence);
                    if (!lecture) return Promise.reject(new Error("수업을 찾지 못했어요."));
                    const lectureInitialState = await getInitialState<LectureInitialState>(`${goormUrl}/learn/lecture/${sequence}/${lecture.url_slug}`, JSON.parse(session.accessToken));
                    const curriculum = lectureInitialState.lectureData.curriculumData.find(v => v.index === lectureIndex);
                    if (!curriculum) return Promise.reject(new Error("커리큘럼을 찾지 못했어요."));
                    const lesson = curriculum.lessons.find(v => v.index === lessonIndex);
                    if (!lesson) return Promise.reject(new Error("과제를 찾지 못했어요."));

                    currentQuizUrl = `${goormUrl}/learn/lecture/${sequence}/${lecture.url_slug}/lesson/${lesson.sequence}/${label}`;
                    const state = await getInitialState<LessonInitialState>(`${goormUrl}/learn/lecture/${sequence}/${lecture.url_slug}/lesson/${lesson.sequence}/${label}`, JSON.parse(session.accessToken));
                    const quiz = state.lesson.quiz;

                    webviewProvider.setHTML(getHTML({
                        "contents": quiz.contents,
                        "inputExample": quiz.inputExample,
                        "outputExample": quiz.outputExample
                    }));

                    await vscode.window.showTextDocument(doc);

                    quizSocket = new SocketIO(goormUrl, {
                        "cookies": JSON.parse(session.accessToken)
                    });

                    quizSocket.on("error", (error: Error) => {
                        vscode.window.showErrorMessage("구름EDU: " + error.message);
                    });

                    quizSocket.on("close", ({ code, reason }) => {
                        vscode.window.showErrorMessage("구름EDU: 소켓이 닫혔어요. " + code + " " + Buffer.from(reason).toString("utf-8"));
                        quizSocket = undefined;
                    });

                    await quizSocket.connect();

                    quizSocket.send("enterance_to_lesson", {
                        "user_id": session.id,
                        "lesson_index": state.lesson.index,
                        "room_id": session.id,
                        "room_type": "user",
                        "lecture_index": state.lecture.index,
                        "channel_index": state.channel.index
                    });
                    quizSocket.send("enterance_to_quiz", {
                        "lectureIndex": state.lecture.index,
                        "examIndex": state.lesson.index,
                        "quizIndex": state.lesson.tutorial_quiz_index,
                        "userId": session.id,
                        "isLesson": true
                    });

                    quizSocket.send("updateBrowserState", {
                        "userId": state.userData.id,
                        "lectureIndex": selectedLectureIndex,
                        "lessonIndex": state.lesson.index,
                        "isBrowserActive": true,
                        "isOnline": true,
                        "userData": state.userData,
                        "channelIndex": state.channel.index
                    });

                    quizSocket.send("entrance_to_collaboration", {
                        "lecture_index": selectedLectureIndex,
                        "lesson_index": state.lesson.index,
                        "collaboration_option": "personal",
                        "owner_id": state.userData.id,
                        "user_id": state.userData.id,
                        "user_name": state.userData.name,
                        "room_id": state.userData.id,
                        "room_type": "user"
                    });

                    return Promise.resolve();
                });
            } catch (err) {
                const e = err as Error;
                vscode.window.showErrorMessage("구름EDU: " + e.message);
                vscode.commands.executeCommand(
                    "setContext",
                    "goorm-ide.isEditingSource",
                    false
                );
            }
        }),
        vscode.commands.registerCommand("goorm-ide.submitQuiz", async () => {
            try {
                let cookieString: string | undefined = undefined;
                if (changeSelectionEvent)
                    changeSelectionEvent.dispose();

                const rawSession = await context.secrets.get("session");
                const goormUrl = await context.secrets.get("goormUrl");

                if (!rawSession || !goormUrl) {
                    for await (const item of await treeProvider.getChildren()) {
                        treeProvider.removeItem(item.id);
                    }
                    return Promise.reject(new Error("재로그인해주세요!"));
                }

                const r = await vscode.window.withProgress<SubmitQuizResponse>({
                    "location": vscode.ProgressLocation.Notification,
                    "title": "제출하고 있습니다...",
                    "cancellable": false
                }, async () => {
                    if (!loggedIn)
                        return Promise.reject(new Error("로그인해주세요!"));

                    if (!selectedLectureIndex) return Promise.reject(new Error("수업을 선택해주세요!"));

                    const session: vscode.AuthenticationSession = JSON.parse(rawSession);
                    const document = vscode.window.activeTextEditor?.document;
                    if (!quizSocket || !document || !currentQuizUrl || !currentProject) return Promise.reject(new Error("과제를 선택해주세요!"));

                    const closeListener = ({ code, reason }: { code: number, reason: Buffer }) => {
                        console.log("[goormEdu] quizSocketClosed", code, reason);
                        return Promise.reject(new Error(code + " " + Buffer.from(reason).toString("utf-8")));
                    };
                    quizSocket.once("close", closeListener);

                    const r = await getInitialState<LessonInitialState>(currentQuizUrl, JSON.parse(session.accessToken));
                    cookieString = session.accessToken;

                    const event = "/submit_quiz/" + r.lesson.quiz_form;
                    quizSocket.send(event, {
                        "id": new Date().getTime(),
                        "filetype": currentProject.mainFiletype,
                        "lang": currentProject.language,
                        "lecture_index": selectedLectureIndex,
                        "lesson_index": r.lesson.index,
                        "quiz_index": r.lesson.tutorial_quiz_index,
                        "user_id": r.userData.id,
                        "userData": r.userData,
                        "removed_bookmarks": [],
                        "source": [
                            document.getText()
                        ],
                        "useTextbook": false
                    });

                    quizSocket.off("close", closeListener);
                    const data = await quizSocket.waitUntil(event, 7000);
                    return Promise.resolve(data);
                });

                if (!currentQuizUrl || !cookieString || !changeSelection) throw new Error("과제를 다시 선택해주세요.");

                if (!changeSelection.command) throw new Error("과제를 다시 선택해주세요.");
                if (!changeSelection.command.arguments) throw new Error("과제를 다시 선택해주세요.");

                const [lectureIndex, lessonIndex, _, seq] = changeSelection.command.arguments;
                const learn = await axios.get<APILearn>("https://sunrint-hs.goorm.io/api/learn", {
                    "headers": {
                        "cookie": stringifyCookie(JSON.parse(cookieString))
                    },
                    "withCredentials": true,
                    "params": {
                        "sequence": seq
                    }
                });
                const curriculum = learn.data.curriculumData.find(v => v.index === lectureIndex);
                if (!curriculum) throw new Error("커리큘럼을 찾을 수 없어요.");
                const lesson = curriculum.lessons.find(v => v.index === lessonIndex);
                if (!lesson) throw new Error("과제를 찾을 수 없어요.");

                const treeItems = await treeProvider.getChildren();
                const currIndexNumber = treeItems.findIndex(v => v.id === curriculum.index);
                if (currIndexNumber === -1) throw new Error("커리큘럼을 찾을 수 없어요.");
                const lessonIndexNumber = (await treeProvider.getChildren(treeItems.find(v => v.id === curriculum.index))).findIndex(v => v.id === lesson.index);
                if (lessonIndexNumber === -1) throw new Error("과제를 찾을 수 없어요.");

                treeProvider.changeItem(currIndexNumber, new TreeViewItem({
                    ...treeItems[currIndexNumber],
                    "icon": curriculum.allLessons === curriculum.completedLessons ? new vscode.ThemeIcon("check") : new vscode.ThemeIcon("folder-library")
                }));
                treeProvider.changeChildren(treeItems[currIndexNumber].id, lessonIndexNumber, new TreeViewItem({
                    ...(await treeProvider.getChildren(treeItems.find(v => v.id === curriculum.index)))[lessonIndexNumber],
                    "icon": (() => {
                        if (lesson.score === 100) return new vscode.ThemeIcon("check");

                        switch (lesson.type) {
                            case 'contents': return new vscode.ThemeIcon("three-bars");
                            default: return new vscode.ThemeIcon("file-code");
                        }
                    })()
                }));

                if (r.submit_mode) {
                    vscode.window.showInformationMessage("코드를 제출했습니다.");
                    return;
                }

                if (r.solved) {
                    vscode.window.showInformationMessage("정답입니다.");
                } else {
                    vscode.window.showErrorMessage("오답입니다.");
                }
            } catch (err) {
                const e = err as Error;
                vscode.window.showErrorMessage("구름EDU: " + e.message);
                console.error(e);
                vscode.commands.executeCommand(
                    "setContext",
                    "goorm-ide.isEditingSource",
                    false
                );
            } finally {
                changeSelectionEvent = treeView.onDidChangeSelection((e) => {
                    changeSelection = e.selection[0];
                });
            }
        }),
        vscode.commands.registerCommand("goorm-ide.runCode", async () => {
            try {
                await vscode.window.withProgress({
                    "title": "실행 준비중...",
                    "location": vscode.ProgressLocation.Notification,
                    "cancellable": false
                }, async () => {
                    if (!loggedIn) return Promise.reject(new Error("로그인해주세요!"));

                    const rawSession = await context.secrets.get("session");
                    const goormUrl = await context.secrets.get("goormUrl");

                    if (!rawSession || !goormUrl) {
                        for await (const item of await treeProvider.getChildren()) {
                            treeProvider.removeItem(item.id);
                        }
                        return Promise.reject(new Error("재로그인해주세요!"));
                    }

                    const document = vscode.window.activeTextEditor;
                    if (
                        !selectedLectureIndex ||
                        !quizSocket ||
                        !quizSocket.sid ||
                        !currentQuizUrl ||
                        !currentProject ||
                        !document
                    ) return Promise.reject(new Error("수업을 선택해주세요!"));

                    const session: vscode.AuthenticationSession = JSON.parse(rawSession);
                    const state = await getInitialState<LessonInitialState>(currentQuizUrl, JSON.parse(session.accessToken));

                    quizSocket.send("run_in_collaboration", {
                        "type": "term",
                        "target": currentProject.label
                    });

                    quizSocket.send("build_in_container", {
                        "filetype": currentProject.mainFiletype,
                        "form": state.lesson.quiz_form,
                        "href": currentQuizUrl,
                        "input": "",
                        "output": "",
                        "lang": "c",
                        "label": "C",
                        "lecture_index": selectedLectureIndex,
                        "lesson_index": state.lesson.index,
                        "quiz_index": state.lesson.tutorial_quiz_index,
                        "show_runtime": true,
                        "source": [
                            document.document.getText()
                        ],
                        "stat": false,
                        "collaboration": true
                    });

                    const containerComplete: ContainerCompleteResponse = await quizSocket.waitUntil("container_complete");
                    const containerSocket = containerComplete.socket;

                    //#region 정리
                    if (debugSocket) {
                        debugSocket.close();
                    }

                    if (currentTerminal) {
                        currentTerminal.dispose();
                    }

                    if (currentTerminalProvider) {
                        currentTerminalProvider.close();
                    }

                    if (currentTerminalDisposable) {
                        currentTerminalDisposable.dispose();
                    }
                    //#endregion

                    const date36radix = () => new Date().getTime().toString(36);
                    const socketUrl = `${containerSocket.options.secure ? "https" : "http"}://${containerSocket.url}${containerSocket.options.path}/`;
                    const pollingSid = await axios.get<string>(socketUrl, {
                        "headers": {
                            "cookie": stringifyCookie(JSON.parse(session.accessToken))
                        },
                        "params": {
                            "EIO": 4,
                            "transport": "polling",
                            "t": date36radix()
                        }
                    });

                    const pollingSidData = JSON.parse(pollingSid.data.slice(1));
                    const sid = pollingSidData.sid;

                    const pollingMustBeOk = await axios.post<string>(socketUrl, "40", {
                        "headers": {
                            "cookie": stringifyCookie(JSON.parse(session.accessToken))
                        },
                        "params": {
                            "EIO": 4,
                            "transport": "polling",
                            "t": date36radix(),
                            "sid": sid
                        }
                    });
                    if (pollingMustBeOk.data !== "ok") return Promise.reject(new Error("예기치 않은 문제가 발생했어요. (polling)"));

                    const pollingRun = await axios.post<string>(socketUrl, `42${JSON.stringify([
                        "run",
                        {
                            "token": containerComplete.token,
                            "daemon": containerComplete.daemon,
                            "app": containerComplete.app,
                            "main": containerComplete.main,
                            "run_option": containerComplete.run_option,
                            "stat": false,
                            "tty_mode": false,
                            "collaboration": true
                        }
                    ])}`, {
                        "headers": {
                            "cookie": stringifyCookie(JSON.parse(session.accessToken))
                        },
                        "params": {
                            "EIO": 4,
                            "transport": "polling",
                            "t": date36radix(),
                            "sid": sid
                        }
                    });
                    if (pollingRun.data !== "ok") return Promise.reject(new Error("예기치 않은 문제가 발생했어요. (run)"));

                    debugSocket = new DebugSocket(
                        socketUrl,
                        sid
                    );

                    currentTerminalProvider = new DebugTerminal();
                    currentTerminal = vscode.window.createTerminal({
                        "name": "구름EDU",
                        "pty": currentTerminalProvider
                    });

                    currentTerminal.show();

                    currentTerminalDisposable = currentTerminalProvider.onDidInput((e) => {
                        debugSocket?.send("pty_execute_command", {
                            "index": containerComplete.token,
                            "command": e
                        });
                    });

                    debugSocket.on("pty_command_result", (data) => {
                        if (!currentTerminalProvider) {
                            vscode.window.showErrorMessage("터미널에 메시지를 쓰지 못했어요.");
                            return;
                        }

                        currentTerminalProvider.write(data.stdout);
                    });

                    debugSocket.on("terminal_exited." + containerComplete.token, () => {
                        if (!debugSocket) {
                            vscode.window.showErrorMessage("예기치 않은 오류가 발생했어요.");
                            return;
                        }
                        debugSocket.sendRaw("41");
                        debugSocket.close();
                    });

                    debugSocket.on("close", () => {
                        if (!currentTerminalProvider || !currentTerminalDisposable) return;

                        if (currentTerminalProvider)
                            currentTerminalProvider.write("\r\n프로세스가 종료되었습니다.");

                        currentTerminalDisposable.dispose();
                        return;
                    });

                    await debugSocket.connect();

                    currentTerminalProvider.write("> ");

                    return Promise.resolve();
                });
            } catch (err) {
                const e = err as Error;
                vscode.window.showErrorMessage("구름EDU: " + e.message);
            }
        })
    );

    // 이벤트 푸시
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(async (e) => {
            if (!e) return;
            const uri = e.document.uri;
            if (!uri.query.startsWith("goorm")) {
                currentQuizUrl = undefined;
                currentProject = undefined;

                if (quizSocket)
                    quizSocket.close();

                vscode.commands.executeCommand(
                    "setContext",
                    "goorm-ide.isEditingSource",
                    false
                );
                return;
            }

            vscode.commands.executeCommand(
                "setContext",
                "goorm-ide.isEditingSource",
                true
            );
        }),
        vscode.workspace.onWillSaveTextDocument((e) => {
            e.waitUntil(new Promise<void>(async (resolve, reject) => {
                try {
                    await vscode.window.withProgress({
                        "location": vscode.ProgressLocation.Notification,
                        "title": "구름EDU에 저장중...",
                        "cancellable": false
                    }, async () => {
                        if (!loggedIn) return Promise.reject(new Error("로그인해주세요!"));

                        const rawSession = await context.secrets.get("session");
                        const goormUrl = await context.secrets.get("goormUrl");

                        if (!rawSession || !goormUrl) {
                            for await (const item of await treeProvider.getChildren()) {
                                treeProvider.removeItem(item.id);
                            }
                            return Promise.reject(new Error("재로그인해주세요!"));
                        }

                        if (!selectedLectureIndex) return Promise.reject(new Error("수업을 선택해주세요!"));
                        if (!currentQuizUrl || !currentProject) return Promise.reject(new Error("과제를 선택해주세요!"));

                        const session: vscode.AuthenticationSession = JSON.parse(rawSession);

                        const r = await getInitialState<LessonInitialState>(currentQuizUrl, JSON.parse(session.accessToken));

                        const saveStatus = await axios.post("https://sunrint-hs.goorm.io/api/workspace/save", {
                            "lectureIndex": r.lecture.index,
                            "examIndex": r.lesson.index,
                            "quizIndex": r.lesson.tutorial_quiz_index,
                            "form": r.lesson.quiz_form,
                            "project": {
                                ...currentProject,
                                "files": [
                                    {
                                        ...currentProject.files[0],
                                        "content": [
                                            {
                                                "hidden": false,
                                                "readonly": false,
                                                "source": e.document.getText().trim()
                                            }
                                        ]
                                    }
                                ]
                            },
                            "userId": r.userData.id,
                            "removedBookmarks": [],
                            "collaborationRoomId": r.userData.id,
                            "collaborationRoomType": "user"
                        }, {
                            "headers": {
                                "cookie": stringifyCookie(JSON.parse(session.accessToken)),
                                "Content-Type": "application/json"
                            }
                        });

                        if (!saveStatus.data?.saved) {
                            return Promise.reject(new Error("알 수 없는 오류로 저장에 실패했어요."));
                        }

                        resolve();
                    });
                } catch (err) {
                    reject(err);
                }
            }));
        })
    );

    await restoreSession();
}

export async function deactivate() {
    fs.rmSync(goormTemp, { "recursive": true });
}