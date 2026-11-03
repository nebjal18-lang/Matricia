export type State={status:"idle"}|{status:"success"}|{status:"error";reason:"VALIDATION"|"FORBIDDEN"|"UNAVAILABLE"};export const idle:State={status:"idle"};
