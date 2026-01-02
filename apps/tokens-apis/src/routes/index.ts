import { Hono } from "hono";
import tokensRoute from "./tokens";
import tokenRoute from "./token";
import validateRoute from "./validate";
import balanceRoute from "./balance";
import priceRoute from "./price";

const routes = new Hono<{ Bindings: Env }>();

routes.route("/tokens", tokensRoute);
routes.route("/token", tokenRoute);
routes.route("/validate", validateRoute);
routes.route("/balance", balanceRoute);
routes.route("/price", priceRoute);

export default routes;
