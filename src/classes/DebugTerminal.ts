import * as vscode from "vscode";
import DebugSocket from "../modules/DebugSocket";

export default class DebugTerminal implements vscode.Pseudoterminal {
    private writeEmitter = new vscode.EventEmitter<string>();
    onDidWrite: vscode.Event<string> = this.writeEmitter.event;

    constructor(
        private socket: DebugSocket
    ) { }

    open() {

    }

    write(data: string) {
        this.writeEmitter.fire(data);
    }

    handleInput(data: string) {
        const char = data.trim();

    }

    close() {

    }
}