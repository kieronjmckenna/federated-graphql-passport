import { PrismaClient, User } from "@prisma/client";


export interface Context{
    prisma: PrismaClient
    req: Express.Request
    res: Express.Response
    logout: () => Promise<void>
    login: (User) => Promise<void>
    authenticate: (arg0: string, arg1: {email: string, password: string}) => Promise<{user: User}>
    isAuthenticated: () => Boolean
}