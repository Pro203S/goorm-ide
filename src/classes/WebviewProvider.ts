import vscode from 'vscode';

export class WebviewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'goormDesc';

    private _view?: vscode.WebviewView;
    private _html: string = "";

    constructor(
        private readonly context: vscode.ExtensionContext
    ) { }

    resolveWebviewView(view: vscode.WebviewView) {
        this._view = view;

        view.webview.options = {
            enableScripts: true
        };

        this.render();
    }

    public setHTML(html: string) {
        this._html = html;
        this.render();
    }

    private render() {
        if (!this._view) return;

        this._view.webview.html = this._html;
    }
}