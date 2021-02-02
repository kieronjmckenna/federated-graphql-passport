import express from "express";

import passport from "passport";

import { buildContext, GraphQLLocalStrategy } from "graphql-passport";

import { buildFederatedSchema } from "@apollo/federation";

import { ApolloServer } from "apollo-server-express";
import { gql } from "apollo-server";

import { PrismaClient } from "@prisma/client";
import { Context } from "./types";

import { PrismaSessionStore } from "@quixo3/prisma-session-store";

var session = require("express-session");

const typeDefs = gql`
  type User @key(fields: "id") {
    id: Int
    email: String
    password: String
  }

  extend type Query {
    Auth: Boolean
  }

  extend type Mutation {
    Login(email: String, password: String): User
    Register(email: String, password: String): User
    Logout: String
  }
`;

const resolvers = {
  Query: {
    Auth: async (_: any, args: {}, context: Context) => {
      return context.isAuthenticated();
    },
  },
  Mutation: {
    Login: async (
      _: any,
      { email, password }: { email: string; password: string },
      context: Context
    ) => {
      const { user } = await context.authenticate("graphql-local", {
        email,
        password,
      });
      context.login(user);

      return user;
    },
    Register: async (
      _: any,
      { email, password }: { email: string; password: string },
      context: Context
    ) => {
      const prisma = context.prisma;

      const user = await prisma.user.create({
        data: { email, password },
      });

      context.login(user);

      return user;
    },
    Logout: async (_: any, args: {}, context: Context) => {
      await context.logout();
      return "Logged Out";
    },
  },
};

const runServer = () => {
  const app = express();

  const prisma = new PrismaClient();

  app.use(
    session({
      store: new PrismaSessionStore(prisma, {
        checkPeriod: 2 * 60 * 1000, //ms
        dbRecordIdIsSessionId: true,
        dbRecordIdFunction: undefined,
      }),
      proxy: true,
      secret: "secret",
      cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1000,
      }, // 30 days
      resave: false,
      saveUninitialized: false,
    })
  );

  app.use(function (req: any, res, done) {
    console.log("session", req.session);
    console.log("session id", req.sessionID);
    done();
  });

  // FUNCTION FOR STORING USER TO THE SESSION
  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  // FUNCTION FOR RETREIVING USER BASED ON SESSION ID

  passport.deserializeUser(async function (id: number, done) {
    let user: any = await prisma.user.findUnique({ where: { id } });

    if (!user) {
      user = undefined;
    }

    return done(null, user);
  });

  // USED IN GRAPHQL RESOLVERS TO AUTHENTICATE CREDENTIALS

  passport.use(
    new GraphQLLocalStrategy(async function (
      email: any,
      password: any,
      done: any
    ) {
      // Adjust this callback to your needs

      const user = await prisma.user.findFirst({ where: { email } });

      let error = null;

      if (!user) {
        error = new Error("Email Incorrect");
        return done(error, user);
      }
      if (user.password !== password) {
        error = new Error("Password Incorrect");
      }

      return done(error, user);
    })
  );

  app.use(passport.initialize());
  app.use(passport.session());

  const server = new ApolloServer({
    schema: buildFederatedSchema({ resolvers, typeDefs }),
    context: ({ req, res }) => {
      return buildContext({ req, res, prisma });
    },
    debug: true,
    playground: {
      settings: {
        "request.credentials": "include",
      },
    },
  });

  server.applyMiddleware({ app, cors: false });

  const port = 4001;

  app.listen(port, () => {
    console.log(
      `🚀 Server ready at http://localhost:${port}${server.graphqlPath}`
    );
  });
};

runServer();
