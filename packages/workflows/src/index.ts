export type Transition<State extends string> = Readonly<{ from: State; to: State; event: string }>;

export * from "./franchise-review";
