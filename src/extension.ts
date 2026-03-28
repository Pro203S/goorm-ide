import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "goorm-ide" is now active!');

	const disposable = vscode.commands.registerCommand('goorm-ide.helloWorld', () => {
		vscode.window.showInformationMessage('Hello World from goorm-ide!');
	});

	context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
