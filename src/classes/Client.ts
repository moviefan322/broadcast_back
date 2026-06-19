import type { Socket } from "socket.io";
import { Room } from "./Room.js";

export class Client {
  userName: string;
  socket: Socket;
  room: Room | null = null;

  constructor(userName: string, socket: Socket) {
    this.userName = userName;
    this.socket = socket;
    this.room = null;
  }
}
