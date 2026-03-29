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

let loggedIn: boolean = false;
let goormTemp: string = path.join(os.tmpdir(), "goorm-ide");
let selectedLectureIndex: string | undefined = undefined;
let currentQuizUrl: string | undefined = undefined;
let currentProject: APIWorkspaceLesson["result"]["project"][string] | undefined = undefined;
let quizSocket: SocketIO | undefined = undefined;
let debugSocket: SocketIO | undefined = undefined;
let changeSelectionEvent: vscode.Disposable | undefined = undefined;
let changeSelection: TreeViewItem | undefined = undefined;

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
                            "description": v.classification.join(", ")
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
                        "label": curriculum.name + " " + curriculum.index,
                        "collapsibleState": vscode.TreeItemCollapsibleState.Collapsed,
                        "icon": curriculum.allLessons === curriculum.completedLessons ? new vscode.ThemeIcon("check") : new vscode.ThemeIcon("folder-library")
                    });
                    treeProvider.addItem(item);
                    for (const lesson of curriculum.lessons) {
                        treeProvider.addChildren(item.id, new TreeViewItem({
                            "id": lesson.index,
                            "label": lesson.name + " " + lesson.index,
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
                const uri = vscode.Uri.parse(filePath + "?goorm");
                fs.writeFileSync(filePath, content, "utf-8");

                const doc = await vscode.workspace.openTextDocument(uri);

                const lecture = (await getInitialState(goormUrl, JSON.parse(session.accessToken))).channelLectureList.allLectures.find(v => v.sequence === sequence);
                if (!lecture) throw new Error("수업을 찾지 못했어요.");
                const lectureInitialState = await getInitialState<LectureInitialState>(`${goormUrl}/learn/lecture/${sequence}/${lecture.url_slug}`, JSON.parse(session.accessToken));
                const curriculum = lectureInitialState.lectureData.curriculumData.find(v => v.index === lectureIndex);
                if (!curriculum) throw new Error("커리큘럼을 찾지 못했어요.");
                const lesson = curriculum.lessons.find(v => v.index === lessonIndex);
                if (!lesson) throw new Error("레슨을 찾지 못했어요.");

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

                quizSocket?.send("enterance_to_lesson", {
                    "user_id": session.id,
                    "lesson_index": state.lesson.index,
                    "room_id": session.id,
                    "room_type": "user",
                    "lecture_index": state.lecture.index,
                    "channel_index": state.channel.index
                });
                quizSocket?.send("enterance_to_quiz", {
                    "lectureIndex": state.lecture.index,
                    "examIndex": state.lesson.index,
                    "quizIndex": state.lesson.tutorial_quiz_index,
                    "userId": session.id,
                    "isLesson": true
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

                const r = await vscode.window.withProgress<SubmitQuizResponse>({
                    "location": vscode.ProgressLocation.Notification,
                    "title": "제출하고 있습니다...",
                    "cancellable": false
                }, async () => {
                    if (!loggedIn)
                        return Promise.reject(new Error("로그인해주세요!"));

                    const rawSession = await context.secrets.get("session");
                    const goormUrl = await context.secrets.get("goormUrl");

                    if (!rawSession || !goormUrl) {
                        for await (const item of await treeProvider.getChildren()) {
                            treeProvider.removeItem(item.id);
                        }
                        return Promise.reject(new Error("재로그인해주세요!"));
                    }

                    if (!selectedLectureIndex) return Promise.reject(new Error("수업을 선택해주세요!"));

                    const session: vscode.AuthenticationSession = JSON.parse(rawSession);
                    const document = vscode.window.activeTextEditor?.document;
                    if (!quizSocket || !document || !currentQuizUrl || !currentProject) return Promise.reject(new Error("과제를 선택해주세요!"));

                    const closeListener = ({ code, reason }: { code: number, reason: Buffer }) => {
                        console.log(code, reason);
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

                if (!currentQuizUrl || !cookieString || !changeSelection) throw new Error("알 수 없는 오류가 발생했어요.");

                const state = await getInitialState<LessonInitialState>(currentQuizUrl, JSON.parse(cookieString));

                console.log(changeSelection, state.lecture.curriculumData.find(v => v.index === changeSelection?.id));

                if (r.solved) {
                    vscode.window.showInformationMessage("정답입니다.");
                } else {
                    vscode.window.showErrorMessage("오답입니다.");
                }
            } catch (err) {
                const e = err as Error;
                vscode.window.showErrorMessage("구름EDU: " + e.message);
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
            e.waitUntil(new Promise<void>(async (resolve) => {
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
                if (!currentQuizUrl) throw new Error("과제를 선택해주세요!");
                if (!currentProject) throw new Error("과제를 선택해주세요!");

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
                    "userId": "117367227022516387857_o6263_google",
                    "removedBookmarks": [],
                    "collaborationRoomId": "117367227022516387857_o6263_google",
                    "collaborationRoomType": "user"
                }, {
                    "headers": {
                        "cookie": stringifyCookie(JSON.parse(session.accessToken)),
                        "Content-Type": "application/json"
                    }
                });

                if (!saveStatus.data?.saved)
                    vscode.window.showErrorMessage("알 수 없는 오류로 저장에 실패헀어요.");

                resolve();
            }));
        })
    );

    await restoreSession();
}

export async function deactivate() {
    fs.rmSync(goormTemp, { "recursive": true });
}