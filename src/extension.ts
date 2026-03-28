import * as vscode from 'vscode';
import TreeDataProvider from './classes/TreeDataProvider';

export function activate(context: vscode.ExtensionContext) {
    vscode.window.registerTreeDataProvider('goormIdeView', new TreeDataProvider());
}