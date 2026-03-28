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

let loggedIn: boolean = false;
let goormTemp: string = path.join(os.tmpdir(), "goorm-ide");

export async function activate(context: vscode.ExtensionContext) {
    if (!fs.existsSync(goormTemp))
        fs.mkdirSync(goormTemp);

    const treeProvider = new TreeDataProvider();
    context.subscriptions.push(
        vscode.window.registerTreeDataProvider('goormTree', treeProvider)
    );

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

            await getInitialState(goormUrl, JSON.parse(session.accessToken));

            loggedIn = true;
            treeProvider.addItem(new TreeViewItem({
                "id": "sessionState",
                "label": session.account.label + "(으)로 로그인",
                "collapsibleState": vscode.TreeItemCollapsibleState.None,
                "icon": new vscode.ThemeIcon("account"),
                "contextValue": "sessionState"
            }));
        } catch (err) {
            const e = err as Error;
            vscode.window.showErrorMessage("구름EDU: " + e.message + "\n재로그인 해주세요.");
        }
    };

    const commands = [
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
        vscode.commands.registerCommand("goorm-ide.selectLearn", async () => {
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

                const lectureId = await vscode.window.showQuickPick(
                    list.map(v => ({
                        "label": v.subject,
                        "value": v.sequence,
                        "description": v.classification.join(", ")
                    })),
                    {
                        "canPickMany": false,
                        "placeHolder": "강좌 선택",
                        "title": "구름EDU"
                    }
                );
                if (!lectureId) return;

                const r = await axios.get<APILearn>("https://sunrint-hs.goorm.io/api/learn", {
                    "headers": {
                        "cookie": stringifyCookie(JSON.parse(session.accessToken))
                    },
                    "withCredentials": true,
                    "params": {
                        "sequence": lectureId.value
                    }
                });

                for await (const item of await treeProvider.getChildren()) {
                    if (item.id === "sessionState") continue;
                    treeProvider.removeItem(item.id);
                }

                const curriculumData = r.data.curriculumData;

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
                        "icon": curriculum.allLessons === curriculum.completedLessons ? new vscode.ThemeIcon("check") : undefined
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
                                    lectureId.value,
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

                vscode.commands.executeCommand(
                    "setContext",
                    "goorm-ide.isEditingSource",
                    true
                );

                const filePath = path.join(goormTemp, name + ".c");
                const uri = vscode.Uri.parse(filePath + "?goorm=asdf");
                fs.writeFileSync(filePath, content, "utf-8");

                const doc = await vscode.workspace.openTextDocument(uri);

                const lecture = (await getInitialState(goormUrl, JSON.parse( session.accessToken))).channelLectureList.allLectures.find(v => v.sequence === sequence);
                if (!lecture) throw new Error("수업을 찾지 못했어요.");
                console.log(`${goormUrl}/learn/lecture/${sequence}/${lecture.url_slug}`);
                const initialState = await getInitialState(`${goormUrl}/learn/lecture/${sequence}/${lecture.url_slug}`, JSON.parse(session.accessToken));

                console.log(`${goormUrl}/learn/lecture/${sequence}/${lecture.url_slug}/lesson/${initialState}/${label}`);
                const state = await getInitialState<LessonInitialState>(`${goormUrl}/learn/lecture/${sequence}/${lecture.url_slug}/lesson/${initialState.}/${label}`, JSON.parse(session.accessToken));
                console.log(state);

                await vscode.window.showTextDocument(doc);
            } catch (err) {
                const e = err as Error;
                vscode.window.showErrorMessage("구름EDU: " + e.message);
            }
        })
    ];

    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(async (e) => {
            if (!e) return;
            const uri = e.document.uri;
            if (!uri.query.startsWith("goorm")) {
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
            e.waitUntil(new Promise(async (resolve) => {

            }));
        }),
    );

    await restoreSession();

    context.subscriptions.push(...commands);
}

export async function deactivate() {
    fs.rmSync(goormTemp, { "recursive": true });
}