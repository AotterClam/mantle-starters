/** Opt-in browser binding over public callable capabilities. */
export async function bindWebMcp(options = {}) {
    const modelContext = options.modelContext ?? browserModelContext();
    if (!modelContext)
        return unsupportedBinding();
    const controller = new AbortController();
    try {
        const capabilities = await resolveCapabilities(options, controller.signal);
        assertUniqueNames(capabilities);
        const existing = modelContext.getTools
            ? new Set((await modelContext.getTools()).map((tool) => tool.name))
            : new Set();
        const skipped = capabilities
            .filter((capability) => existing.has(capability.name))
            .map((capability) => capability.name);
        const pending = capabilities.filter((capability) => !existing.has(capability.name));
        await Promise.all(pending.map((capability) => modelContext.registerTool(toWebMcpTool(capability, options), { signal: controller.signal })));
        return binding(pending.map((capability) => capability.name), skipped, controller);
    }
    catch (error) {
        controller.abort();
        throw error;
    }
}
function resolveCapabilities(options, signal) {
    const capabilities = options.capabilities;
    const invoke = options.invoke;
    if (capabilities === undefined && invoke === undefined) {
        return serverCapabilities(options, signal);
    }
    if (!Array.isArray(capabilities) || typeof invoke !== "function") {
        throw new TypeError("WebMCP capabilities and invoke must be provided together.");
    }
    return localCapabilities(capabilities, invoke);
}
function localCapabilities(capabilities, invoke) {
    return capabilities
        .filter((capability) => capability.surface === "public")
        .map((capability) => ({
        name: capability.name,
        ...(capability.title ? { title: capability.title } : {}),
        description: capability.description,
        inputSchema: capability.inputSchema,
        annotations: {
            readOnlyHint: capability.kind === "view" || capability.inputSchema.readOnly === true,
            ...(capability.kind === "view" ? { untrustedContentHint: true } : {}),
        },
        target: Object.freeze({ kind: capability.kind, name: capability.ownerName }),
        invoke: (input, signal) => invoke(capability, input, signal),
    }));
}
async function serverCapabilities(options, signal) {
    const prefix = endpointPrefix(options.endpointPrefix);
    const fetcher = options.fetch ?? fetch;
    const response = await fetcher(prefix, {
        method: "GET",
        credentials: "same-origin",
        headers: { accept: "application/json" },
        signal,
    });
    if (!response.ok)
        throw new Error(`Mantle WebMCP catalog failed (${response.status}).`);
    return readCatalog(await response.json()).map((view) => ({
        ...view,
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        invoke: (input, invocationSignal) => queryView(view, input, invocationSignal, prefix, fetcher),
    }));
}
function toWebMcpTool(capability, options) {
    return {
        name: capability.name,
        ...(capability.title ? { title: capability.title } : {}),
        description: capability.description,
        inputSchema: capability.inputSchema,
        annotations: capability.annotations,
        execute: async (input, context) => {
            if (!input || typeof input !== "object" || Array.isArray(input)) {
                throw new TypeError("WebMCP tool input must be an object.");
            }
            const signal = context.signal ?? new AbortController().signal;
            const call = Object.freeze({
                name: capability.name,
                target: capability.target,
                input,
                signal,
            });
            let result;
            try {
                signal.throwIfAborted();
                await options.before?.(call);
                result = {
                    status: "fulfilled",
                    value: await capability.invoke(input, signal),
                };
            }
            catch (reason) {
                result = { status: "rejected", reason };
            }
            try {
                await options.after?.(call, result);
            }
            catch {
                // Observational hooks never change the domain result.
            }
            if (result.status === "fulfilled")
                return result.value;
            throw result.reason;
        },
    };
}
function endpointPrefix(prefix = "/api/views") {
    const normalized = prefix.replace(/\/$/u, "");
    if (!/^\/(?!\/)[^\\?#]*$/u.test(normalized)) {
        throw new TypeError("WebMCP endpointPrefix must be a same-origin absolute path.");
    }
    return normalized;
}
async function queryView(view, input, signal, prefix, fetcher) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(input)) {
        if (["string", "number", "boolean"].includes(typeof value)) {
            query.set(key, String(value));
        }
    }
    const search = query.size ? `?${query}` : "";
    const response = await fetcher(`${prefix}/${encodeURIComponent(view.target.name)}${search}`, {
        method: "GET",
        credentials: "same-origin",
        headers: { accept: "application/json" },
        signal,
    });
    if (!response.ok) {
        throw new Error(`Mantle View '${view.target.name}' failed (${response.status}).`);
    }
    const body = await response.json();
    return isRecord(body) && body.ok === true ? body.data : body;
}
function readCatalog(body) {
    if (!isRecord(body) || body.ok !== true || !Array.isArray(body.data)) {
        throw new TypeError("Mantle WebMCP catalog response is invalid.");
    }
    return body.data.map((value) => {
        if (!isRecord(value)
            || typeof value.name !== "string"
            || typeof value.description !== "string"
            || !isRecord(value.inputSchema)
            || !isRecord(value.target)
            || value.target.kind !== "view"
            || typeof value.target.name !== "string"
            || (value.title !== undefined && typeof value.title !== "string")) {
            throw new TypeError("Mantle WebMCP catalog contains an invalid View.");
        }
        return Object.freeze({
            name: value.name,
            target: Object.freeze({ kind: "view", name: value.target.name }),
            ...(value.title ? { title: value.title } : {}),
            description: value.description,
            inputSchema: value.inputSchema,
        });
    });
}
function isRecord(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
}
function assertUniqueNames(capabilities) {
    const names = new Set();
    for (const capability of capabilities) {
        if (names.has(capability.name)) {
            throw new TypeError(`Duplicate WebMCP capability name '${capability.name}'.`);
        }
        names.add(capability.name);
    }
}
function browserModelContext() {
    const modelContext = globalThis
        .document?.modelContext;
    return modelContext && typeof modelContext.registerTool === "function"
        ? modelContext
        : undefined;
}
function binding(registered, skipped, controller) {
    return Object.freeze({
        supported: true,
        registered: Object.freeze(registered),
        skipped: Object.freeze(skipped),
        dispose: () => controller.abort(),
    });
}
function unsupportedBinding() {
    return Object.freeze({
        supported: false,
        registered: Object.freeze([]),
        skipped: Object.freeze([]),
        dispose: () => { },
    });
}
