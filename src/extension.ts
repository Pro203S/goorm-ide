import * as vscode from 'vscode';
import TreeDataProvider from './classes/TreeDataProvider';
import AuthenticationProvider from './classes/AuthenticationProvider';

export function activate(context: vscode.ExtensionContext) {
    const treeProvider = new TreeDataProvider();
    context.subscriptions.push(
        vscode.window.registerTreeDataProvider('goormIdeView', treeProvider)
    );

    const authProvider = new AuthenticationProvider("https://sunrint-hs.goorm.io");
    context.subscriptions.push(
        vscode.authentication.registerAuthenticationProvider("goormIde", "구름EDU", authProvider, { "supportsMultipleAccounts": false })
    );

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
                console.log(session);
            } catch (err) {
                const e = err as Error;
                vscode.window.showErrorMessage("구름EDU: " + e.message);
            }
        })
    ];

    context.subscriptions.push(...commands);
}