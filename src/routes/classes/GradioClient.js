class GradioClient {
    constructor({
        baseUrl,
        apiPrefix = "/gradio_api",
        apiName = "generate",
        tokens = [],
    }) {
        this.baseUrl = baseUrl.replace(/\/$/, "");
        this.apiPrefix = apiPrefix;
        this.apiName = apiName;
        this.tokens = tokens;
        this.tokenIndex = 0;
    }

    getNextToken() {
        if (!this.tokens.length) return null;

        const token = this.tokens[this.tokenIndex];
        this.tokenIndex = (this.tokenIndex + 1) % this.tokens.length;
        return token;
    }

    buildHeaders() {
        const headers = { "Content-Type": "application/json" };
        const token = this.getNextToken();
        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }
        return headers;
    }

    async submit(data) {
        const url = `${this.baseUrl}${this.apiPrefix}/call/${this.apiName}`;
        const res = await fetch(url, {
            method: "POST",
            headers: this.buildHeaders(),
            body: JSON.stringify({ data }),
        });

        if (!res.ok) {
            throw new Error(
                `POST ${res.status} ${res.statusText}\n${await res.text()}`
            );
        }

        return res.json();
    }

    async readStream(eventId) {
        const url = `${this.baseUrl}${this.apiPrefix}/call/${this.apiName}/${eventId}`;
        const res = await fetch(url, { headers: this.buildHeaders() });

        if (!res.ok) {
            throw new Error(
                `GET ${res.status} ${res.statusText}\n${await res.text()}`
            );
        }

        if (!res.body) {
            throw new Error("No response body returned by the server.");
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buf += decoder.decode(value, { stream: true });

            let idx;
            while ((idx = buf.indexOf("\n\n")) !== -1) {
                const block = buf.slice(0, idx).trim();
                buf = buf.slice(idx + 2);
                if (!block) continue;

                let event = "";
                let dataLine = "";

                for (const line of block.split(/\r?\n/)) {
                    if (line.startsWith("event:")) event = line.slice(6).trim();
                    if (line.startsWith("data:")) dataLine = line.slice(5).trim();
                }

                if (!dataLine) continue;

                let parsed = dataLine;
                try {
                    parsed = JSON.parse(dataLine);
                } catch { }

                if (event === "complete") return parsed;
                if (event === "error") {
                    throw new Error(`Gradio error: ${JSON.stringify(parsed)}`);
                }

                console.log(event || "message", parsed);
            }
        }
    }

    async generate(inputJson) {
        const { event_id } = await this.submit([inputJson]);
        return this.readStream(event_id);
    }
}

module.exports = GradioClient;