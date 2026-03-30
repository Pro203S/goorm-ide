import axios from "axios";
import { stringifyCookie } from "cookie";

//let cache: Record<string, any> = {};

export default async function getInitialState<T = InitialState>(goormUrl: string, cookies: {
    "accounts.sid": string,
    "goorm.sid": string,
    "goormaccounts.sid": string,
    "goorm.lang": string
}): Promise<T> {
    //if (cache[goormUrl]) return cache[goormUrl];

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

    /*
    cache[goormUrl] = content;
    setTimeout(() => {
        delete cache[goormUrl];
    }, 2 * 60 * 60 * 1000);
    */

    return content;
}