export default function getHTML(params: {
    "contents": string,
    "inputExample": string[],
    "outputExample": string[]
}) {
    return `
<html>
    <head>
        <style>
            body {
                padding: 5px;
                display: flex;
                flex-direction: column;
            }
            .desc {
                display: flex;
                flex-direction: column;
                gap: 3px;
            }
            
            .sep {
                margin-top: 5px;
                margin-bottom: 5px;
                width: 100%;
                height: .5px;
                backgroud-color: #fff;
            }

            .desc .title {
                margin-left: 5px;
                opacity: 0.5;
                font-size: 0.7rem;
            }
        </style>
    </head>
    <body>
        <span>에디터의 오른쪽 위 제출 버튼을 눌러 제출해요.</span>
        <div class="desc">
            ${params.contents}
        </div>
        <div class="sep"></div>
        <div class="desc">
            <span class="title">입력 예시</span>
            ${params.inputExample.map(v => `<span class="content">${v.replaceAll("\n", "<br>")}</span>`)}
        </div>
        <div class="sep"></div>
        <div class="desc">
            <span class="title">출력 예시</span>
            ${params.outputExample.map(v => `<span class="content">${v.replaceAll("\n", "<br>")}</span>`)}
        </div>
        <div class="sep"></div>
    </body>
</html>`;
}