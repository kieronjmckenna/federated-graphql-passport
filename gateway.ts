import express from "express";

import { ApolloGateway, RemoteGraphQLDataSource } from "@apollo/gateway";

import { ApolloServer } from "apollo-server-express";

import waitOn from "wait-on";

import parseCookies from "./utils/parseCookies";

const runServer = async () => {
  const app = express();

  await waitOn({
    resources: ["tcp:4001"],
    timeout: 3000,
    interval: 50,
  });

  const gateway = new ApolloGateway({
    serviceList: [
      { name: "auth", url: "http://localhost:4001/graphql" },
    ],
    buildService({ name, url }) {
      return new RemoteGraphQLDataSource({
        url,
        willSendRequest({ request, context }) {
          const cookie = context?.cookie;
          cookie && request?.http?.headers.set("cookie", cookie);
        },
        didReceiveResponse({ response, context }): typeof response {
 
          const rawCookies = response.http.headers.get("set-cookie") as
            | string
            | null;

          if (rawCookies) {
            const cookies = parseCookies(rawCookies);

            cookies.forEach(({ cookieName, cookieValue, options }) => {
              if (context && context.res) {
                if (cookieName === "connect.sid") {
                  context.res.cookie(
                    cookieName,
                    response.http.headers.get("cookie"),
                    { ...options }
                  );
                }
                context.res.cookie(cookieName, cookieValue, { ...options });
              }
            });
          }
          return response;
        },
      });
    },
  });


  const server = new ApolloServer({
    gateway,
    subscriptions: false,
    context: ({ req, res }) => {
      const cookie = req.headers.cookie;
      return { cookie };
    },
    playground: {
      settings: {
        "request.credentials": "include",
      },
    },
  });


  server.applyMiddleware({ app });
  
  const port = 4000

  app.listen(port, () => {
    console.log(
      `🚀 Server ready at http://localhost:${port}${server.graphqlPath}`
    );
  });
};

runServer();
