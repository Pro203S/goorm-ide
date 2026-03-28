import * as vscode from 'vscode';
import TreeDataProvider from './classes/TreeDataProvider';
import AuthenticationProvider from './classes/AuthenticationProvider';
import TreeViewItem from './classes/TreeViewItem';
import getUserData from './modules/getInitialState';

export async function activate(context: vscode.ExtensionContext) {
    const treeProvider = new TreeDataProvider();
    context.subscriptions.push(
        vscode.window.registerTreeDataProvider('goormIdeView', treeProvider)
    );

    const authProvider = new AuthenticationProvider("https://sunrint-hs.goorm.io");
    context.subscriptions.push(
        vscode.authentication.registerAuthenticationProvider("goormIde", "구름EDU", authProvider, { "supportsMultipleAccounts": false })
    );

    //#region 세션 복구

    const restoreSession = async () => {
        try {
            const rawSession = await context.secrets.get("session");
            const goormUrl = await context.secrets.get("goormUrl");

            if (!rawSession || !goormUrl) return;

            const session: vscode.AuthenticationSession = JSON.parse(rawSession);

            await getUserData(goormUrl, JSON.parse(session.accessToken));

            treeProvider.addItem(new TreeViewItem({
                "id": "session-state",
                "label": session.account.label + "(으)로 로그인",
                "collapsibleState": vscode.TreeItemCollapsibleState.None,
                "icon": new vscode.ThemeIcon("account")
            }));
        } catch (err) {
            const e = err as Error;
            vscode.window.showErrorMessage("구름EDU: " + e.message + "\n재로그인 해주세요.");
        }
    };

    //#endregion

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
        vscode.commands.registerCommand("goorm-ide.Login", async () => {
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

    ];

    await restoreSession();

    context.subscriptions.push(...commands);
}