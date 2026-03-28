import vscode from 'vscode';
import getUserData from '../modules/getUserData';

async function inputBox(cookieName: string) {
    const result = await vscode.window.showInputBox({
        "ignoreFocusOut": true,
        "placeHolder": `${cookieName}의 값`,
        "prompt": `구름 사이트의 개발자 모드에서 ${cookieName}의 쿠키 값을 입력해주세요. | 개발자 모드 -> 애플리케이션 -> 쿠키`,
        "password": true
    });
    if (!result)
        throw new Error("값이 입력되지 않았어요!");

    return result;
}

export default class AuthenticationProvider implements vscode.AuthenticationProvider {
    private _onDidChangeSessions: vscode.EventEmitter<vscode.AuthenticationProviderAuthenticationSessionsChangeEvent> = new vscode.EventEmitter();
    readonly onDidChangeSessions = this._onDidChangeSessions.event;

    private _sessions: vscode.AuthenticationSession[] = [];

    constructor(
        public goormUrl: string
    ) {
        this.goormUrl = goormUrl;
    }

    getSessions(): Thenable<vscode.AuthenticationSession[]> {
        return Promise.resolve(this._sessions);
    }

    async createSession(): Promise<vscode.AuthenticationSession> {
        vscode.env.openExternal(vscode.Uri.parse(this.goormUrl + "/login"));

        const accountsSid = await inputBox("accounts.sid");
        const goormSid = await inputBox("goorm.sid");
        const goormaccountsSid = await inputBox("goormaccounts.sid");

        const cookies = {
            "accounts.sid": accountsSid,
            "goorm.sid": goormSid,
            "goormaccounts.sid": goormaccountsSid,
            "goorm.lang": "kor"
        };

        const userData = await getUserData(this.goormUrl, cookies);

        const session = {
            "accessToken": JSON.stringify(cookies),
            "account": {
                "id": userData.id,
                "label": userData.name
            },
            "id": userData.id,
            "scopes": []
        };

        this._sessions.push(session);

        this._onDidChangeSessions.fire({
            "added": [session],
            "removed": [],
            "changed": []
        });
        return session;
    }

    removeSession(sessionId: string): Thenable<void> {
        const removedSession = this._sessions.find(v => v.id === sessionId);
        if (!removedSession) return Promise.reject();

        const sessions = this._sessions.filter(v => v.id !== sessionId);
        this._sessions = sessions;
        this._onDidChangeSessions.fire({
            "added": [],
            "removed": [removedSession],
            "changed": []
        });
        return Promise.resolve();
    }
}