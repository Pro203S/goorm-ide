import WebSocket from "ws";

type Listener = (data: any) => void;

export default class SocketIO {
    private ws?: WebSocket;
    private sid?: string;

    private listeners = new Map<string, Listener[]>();

    constructor(
        private baseUrl: string,
        private opts?: {
            cookies?: Record<string, string>;
        }
    ) { }

    private buildCookie() {
        if (!this.opts?.cookies) return "";
        return Object.entries(this.opts.cookies)
            .map(([k, v]) => `${k}=${v}`)
            .join("; ");
    }

    connect() {
        // 2️⃣ websocket 연결
        const wsUrl = this.baseUrl.replace(/^http/, "ws");
        this.ws = new WebSocket(
            `${wsUrl}/socket.io/?EIO=4&transport=websocket`,
            {
                headers: {
                    Cookie: this.buildCookie()
                }
            }
        );

        // 3️⃣ 연결 처리
        this.ws.on("open", () => {
            this.ws?.send("40"); // socket.io connect
        });

        this.ws.on("close", (code, reason) => {
            console.log("closed", code, Buffer.from(reason).toString("utf-8"));
        });

        let received40 = false;

        // 4️⃣ 메시지 처리
        this.ws.on("message", (msg) => {
            try {
                const str = msg.toString();
                console.log("D", str);

                // ping
                if (str === "2") {
                    this.ws?.send("3");
                    return;
                }

                // 연결 처리
                if (str.startsWith("0")) {
                    this.ws?.send("40");
                    return;
                }

                if (str.startsWith("40") && !received40) {
                    received40 = true;
                    const obj = JSON.parse(str.slice(2));
                    this.sid = obj.sid;
                    this.emitLocal("connect", this.sid);
                    return;
                }

                // event
                if (str.startsWith("42")) {
                    const [event, data] = JSON.parse(str.slice(2));
                    this.emitLocal(event, data);
                }
            } catch (err) {
                const e = err as Error;
                this.emitLocal("error", e);
                this.close();
            }
        });
    }

    async send(event: string, data: any) {
        if (!this.ws) throw new Error("not connected");

        const payload = `42${JSON.stringify([event, data])}`;
        console.log("S", payload);
        this.ws.send(payload);
    }

    on(event: string, listener: Listener) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event)!.push(listener);
    }

    private emitLocal(event: string, data: any) {
        const list = this.listeners.get(event);
        if (!list) return;

        for (const l of list) {
            l(data);
        }
    }

    close() {
        this.ws?.close();
        this.ws = undefined;
    }
}