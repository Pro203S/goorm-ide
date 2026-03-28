import axios from "axios";
import { stringifyCookie } from "cookie";

let cache: InitialState | undefined = undefined;

export default async function getInitialState(goormUrl: string, cookies: {
    "accounts.sid": string,
    "goorm.sid": string,
    "goormaccounts.sid": string,
    "goorm.lang": string
}): Promise<InitialState> {
    if (cache) return cache;

    const r = await axios.get<string>(goormUrl, {
        "headers": {
            "cookie": stringifyCookie(cookies)
        },
        "withCredentials": true
    });

    const data = r.data.split("\n");
    const toFind = "window.__INITIAL_STATE__ = ";
    const InitialStateIndex = data.findIndex(v => v.includes(toFind));
    const parsed = data[InitialStateIndex].trim().substring(toFind.length);
    const content = new Function(`return ${parsed}`)();

    cache = content;
    setTimeout(() => {
        cache = undefined;
    }, 2 * 60 * 60 * 1000);

    return content;
}