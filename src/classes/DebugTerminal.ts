import * as vscode from "vscode";

export default class DebugTerminal implements vscode.Pseudoterminal {
    private writeEmitter = new vscode.EventEmitter<string>();
    private inputEmitter = new vscode.EventEmitter<string>();
    onDidWrite: vscode.Event<string> = this.writeEmitter.event;
    onDidInput = this.inputEmitter.event;

    constructor() { }

    open() {

    }

    write(data: string) {
        this.writeEmitter.fire(data);
    }

    handleInput(data: string) {
        if (data === "\r")
            return this.inputEmitter.fire("\r\n");
        
        this.inputEmitter.fire(data);
    }

    close() {

    }
}