import axios from "axios";
import { stringifyCookie } from "cookie";

export default async function getUserData(goormUrl: string, cookies: Record<string, string>): Promise<InitialState["userData"]> {
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

    return content.userData;
}