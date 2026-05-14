import { Tree } from 'web-tree-sitter';
import type { SyntaxNode } from '../../../utils/ast-helpers.js';
import { extractStringContent, findDescendant } from '../../../utils/ast-helpers.js';
import type { ExtractedRoute } from '../types.js';
import {
  ROUTE_HTTP_METHODS,
  ROUTE_RESOURCE_METHODS,
  RESOURCE_ACTIONS,
  API_RESOURCE_ACTIONS,
} from '../constants.js';

interface RouteGroupContext {
  middleware: string[];
  prefix: string | null;
  controller: string | null;
}

function isRouteStaticCall(node: SyntaxNode): boolean {
  if (node.type !== 'scoped_call_expression') return false;
  const obj = node.childForFieldName?.('object') ?? node.children?.[0];
  return obj?.text === 'Route';
}

function getCallMethodName(node: SyntaxNode): string | null {
  const nameNode =
    node.childForFieldName?.('name') ?? node.children?.find((c: SyntaxNode) => c.type === 'name');
  return nameNode?.text ?? null;
}

function getArguments(node: SyntaxNode): SyntaxNode | null {
  return node.children?.find((c: SyntaxNode) => c.type === 'arguments') ?? null;
}

function findClosureBody(argsNode: SyntaxNode | null): SyntaxNode | null {
  if (!argsNode) return null;
  for (const child of argsNode.children ?? []) {
    if (child.type === 'argument') {
      for (const inner of child.children ?? []) {
        if (inner.type === 'anonymous_function' || inner.type === 'arrow_function') {
          return (
            inner.childForFieldName?.('body') ??
            inner.children?.find((c: SyntaxNode) => c.type === 'compound_statement') ??
            null
          );
        }
      }
    }
    if (child.type === 'anonymous_function' || child.type === 'arrow_function') {
      return (
        child.childForFieldName?.('body') ??
        child.children?.find((c: SyntaxNode) => c.type === 'compound_statement') ??
        null
      );
    }
  }
  return null;
}

function extractFirstStringArg(argsNode: SyntaxNode | null): string | null {
  if (!argsNode) return null;
  for (const child of argsNode.children ?? []) {
    const target = child.type === 'argument' ? child.children?.[0] : child;
    if (!target) continue;
    if (target.type === 'string' || target.type === 'encapsed_string') {
      return extractStringContent(target);
    }
  }
  return null;
}

function extractMiddlewareArg(argsNode: SyntaxNode | null): string[] {
  if (!argsNode) return [];
  for (const child of argsNode.children ?? []) {
    const target = child.type === 'argument' ? child.children?.[0] : child;
    if (!target) continue;
    if (target.type === 'string' || target.type === 'encapsed_string') {
      const val = extractStringContent(target);
      return val ? [val] : [];
    }
    if (target.type === 'array_creation_expression') {
      const items: string[] = [];
      for (const el of target.children ?? []) {
        if (el.type === 'array_element_initializer') {
          const str = el.children?.find(
            (c: SyntaxNode) => c.type === 'string' || c.type === 'encapsed_string',
          );
          const val = str ? extractStringContent(str) : null;
          if (val) items.push(val);
        }
      }
      return items;
    }
  }
  return [];
}

function extractClassArg(argsNode: SyntaxNode | null): string | null {
  if (!argsNode) return null;
  for (const child of argsNode.children ?? []) {
    const target = child.type === 'argument' ? child.children?.[0] : child;
    if (target?.type === 'class_constant_access_expression') {
      return target.children?.find((c: SyntaxNode) => c.type === 'name')?.text ?? null;
    }
  }
  return null;
}

function extractControllerTarget(argsNode: SyntaxNode | null): {
  controller: string | null;
  method: string | null;
} {
  if (!argsNode) return { controller: null, method: null };

  const args: (SyntaxNode | undefined)[] = [];
  for (const child of argsNode.children ?? []) {
    if (child.type === 'argument') args.push(child.children?.[0]);
    else if (child.type !== '(' && child.type !== ')' && child.type !== ',') args.push(child);
  }

  const handlerNode = args[1];
  if (!handlerNode) return { controller: null, method: null };

  if (handlerNode.type === 'array_creation_expression') {
    let controller: string | null = null;
    let method: string | null = null;
    const elements: SyntaxNode[] = [];
    for (const el of handlerNode.children ?? []) {
      if (el.type === 'array_element_initializer') elements.push(el);
    }
    if (elements[0]) {
      const classAccess = findDescendant(elements[0], 'class_constant_access_expression');
      if (classAccess) {
        controller = classAccess.children?.find((c: SyntaxNode) => c.type === 'name')?.text ?? null;
      }
    }
    if (elements[1]) {
      const str = findDescendant(elements[1], 'string');
      method = str ? extractStringContent(str) : null;
    }
    return { controller, method };
  }

  if (handlerNode.type === 'string' || handlerNode.type === 'encapsed_string') {
    const text = extractStringContent(handlerNode);
    if (text?.includes('@')) {
      const [controller, method] = text.split('@');
      return { controller, method };
    }
  }

  if (handlerNode.type === 'class_constant_access_expression') {
    const controller =
      handlerNode.children?.find((c: SyntaxNode) => c.type === 'name')?.text ?? null;
    return { controller, method: '__invoke' };
  }

  return { controller: null, method: null };
}

interface ChainedRouteCall {
  isRouteFacade: boolean;
  terminalMethod: string;
  attributes: { method: string; argsNode: SyntaxNode | null }[];
  terminalArgs: SyntaxNode | null;
  node: SyntaxNode;
}

function unwrapRouteChain(node: SyntaxNode): ChainedRouteCall | null {
  if (node.type !== 'member_call_expression') return null;

  const terminalMethod = getCallMethodName(node);
  if (!terminalMethod) return null;

  const terminalArgs = getArguments(node);
  const attributes: { method: string; argsNode: SyntaxNode | null }[] = [];

  let current = node.children?.[0];

  while (current) {
    if (current.type === 'member_call_expression') {
      const method = getCallMethodName(current);
      const args = getArguments(current);
      if (method) attributes.unshift({ method, argsNode: args });
      current = current.children?.[0];
    } else if (current.type === 'scoped_call_expression') {
      const obj = current.childForFieldName?.('object') ?? current.children?.[0];
      if (obj?.text !== 'Route') return null;

      const method = getCallMethodName(current);
      const args = getArguments(current);
      if (method) attributes.unshift({ method, argsNode: args });

      return { isRouteFacade: true, terminalMethod, attributes, terminalArgs, node };
    } else {
      break;
    }
  }

  return null;
}

function parseArrayGroupArgs(argsNode: SyntaxNode | null): RouteGroupContext {
  const ctx: RouteGroupContext = { middleware: [], prefix: null, controller: null };
  if (!argsNode) return ctx;

  for (const child of argsNode.children ?? []) {
    const target = child.type === 'argument' ? child.children?.[0] : child;
    if (target?.type === 'array_creation_expression') {
      for (const el of target.children ?? []) {
        if (el.type !== 'array_element_initializer') continue;
        const children = el.children ?? [];
        const arrowIdx = children.findIndex((c: SyntaxNode) => c.type === '=>');
        if (arrowIdx === -1) continue;
        const key = extractStringContent(children[arrowIdx - 1]);
        const val = children[arrowIdx + 1];
        if (key === 'middleware') {
          if (val?.type === 'string') {
            const s = extractStringContent(val);
            if (s) ctx.middleware.push(s);
          } else if (val?.type === 'array_creation_expression') {
            for (const item of val.children ?? []) {
              if (item.type === 'array_element_initializer') {
                const str = item.children?.find((c: SyntaxNode) => c.type === 'string');
                const s = str ? extractStringContent(str) : null;
                if (s) ctx.middleware.push(s);
              }
            }
          }
        } else if (key === 'prefix') {
          ctx.prefix = extractStringContent(val) ?? null;
        } else if (key === 'controller') {
          if (val?.type === 'class_constant_access_expression') {
            ctx.controller = val.children?.find((c: SyntaxNode) => c.type === 'name')?.text ?? null;
          }
        }
      }
    }
  }
  return ctx;
}

export function extractLaravelRoutes(tree: Tree, filePath: string): ExtractedRoute[] {
  const routes: ExtractedRoute[] = [];

  function resolveStack(stack: RouteGroupContext[]): {
    middleware: string[];
    prefix: string | null;
    controller: string | null;
  } {
    const middleware: string[] = [];
    let prefix: string | null = null;
    let controller: string | null = null;
    for (const ctx of stack) {
      middleware.push(...ctx.middleware);
      if (ctx.prefix) prefix = prefix ? `${prefix}/${ctx.prefix}`.replace(/\/+/g, '/') : ctx.prefix;
      if (ctx.controller) controller = ctx.controller;
    }
    return { middleware, prefix, controller };
  }

  function emitRoute(
    httpMethod: string,
    argsNode: SyntaxNode | null,
    lineNumber: number,
    groupStack: RouteGroupContext[],
    chainAttrs: { method: string; argsNode: SyntaxNode | null }[],
  ) {
    const effective = resolveStack(groupStack);

    for (const attr of chainAttrs) {
      if (attr.method === 'middleware')
        effective.middleware.push(...extractMiddlewareArg(attr.argsNode));
      if (attr.method === 'prefix') {
        const p = extractFirstStringArg(attr.argsNode);
        if (p) effective.prefix = effective.prefix ? `${effective.prefix}/${p}` : p;
      }
      if (attr.method === 'controller') {
        const cls = extractClassArg(attr.argsNode);
        if (cls) effective.controller = cls;
      }
    }

    const routePath = extractFirstStringArg(argsNode);

    if (ROUTE_RESOURCE_METHODS.has(httpMethod)) {
      const target = extractControllerTarget(argsNode);
      const actions = httpMethod === 'apiResource' ? API_RESOURCE_ACTIONS : RESOURCE_ACTIONS;
      for (const action of actions) {
        routes.push({
          filePath,
          httpMethod,
          routePath,
          controllerName: target.controller ?? effective.controller,
          methodName: action,
          middleware: [...effective.middleware],
          prefix: effective.prefix,
          lineNumber,
        });
      }
    } else {
      const target = extractControllerTarget(argsNode);
      routes.push({
        filePath,
        httpMethod,
        routePath,
        controllerName: target.controller ?? effective.controller,
        methodName: target.method,
        middleware: [...effective.middleware],
        prefix: effective.prefix,
        lineNumber,
      });
    }
  }

  interface WalkFrame {
    node: SyntaxNode;
    groupSnapshot: RouteGroupContext[];
  }

  const walkStack: WalkFrame[] = [{ node: tree.rootNode as unknown as SyntaxNode, groupSnapshot: [] }];

  while (walkStack.length > 0) {
    const { node, groupSnapshot } = walkStack.pop()!;

    if (isRouteStaticCall(node)) {
      const method = getCallMethodName(node);
      if (method && (ROUTE_HTTP_METHODS.has(method) || ROUTE_RESOURCE_METHODS.has(method))) {
        emitRoute(method, getArguments(node), node.startPosition.row, groupSnapshot, []);
        continue;
      }
      if (method === 'group') {
        const argsNode = getArguments(node);
        const groupCtx = parseArrayGroupArgs(argsNode);
        const body = findClosureBody(argsNode);
        if (body) {
          const childSnapshot = [...groupSnapshot, groupCtx];
          const children = body.children ?? [];
          for (let i = children.length - 1; i >= 0; i--) {
            walkStack.push({ node: children[i], groupSnapshot: childSnapshot });
          }
        }
        continue;
      }
    }

    const chain = unwrapRouteChain(node);
    if (chain) {
      if (chain.terminalMethod === 'group') {
        const groupCtx: RouteGroupContext = { middleware: [], prefix: null, controller: null };
        for (const attr of chain.attributes) {
          if (attr.method === 'middleware')
            groupCtx.middleware.push(...extractMiddlewareArg(attr.argsNode));
          if (attr.method === 'prefix') groupCtx.prefix = extractFirstStringArg(attr.argsNode);
          if (attr.method === 'controller') groupCtx.controller = extractClassArg(attr.argsNode);
        }
        const body = findClosureBody(chain.terminalArgs);
        if (body) {
          const childSnapshot = [...groupSnapshot, groupCtx];
          const children = body.children ?? [];
          for (let i = children.length - 1; i >= 0; i--) {
            walkStack.push({ node: children[i], groupSnapshot: childSnapshot });
          }
        }
        continue;
      }
      if (
        ROUTE_HTTP_METHODS.has(chain.terminalMethod) ||
        ROUTE_RESOURCE_METHODS.has(chain.terminalMethod)
      ) {
        emitRoute(
          chain.terminalMethod,
          chain.terminalArgs,
          node.startPosition.row,
          groupSnapshot,
          chain.attributes,
        );
        continue;
      }
    }

    const children = node.children ?? [];
    for (let i = children.length - 1; i >= 0; i--) {
      walkStack.push({ node: children[i], groupSnapshot });
    }
  }
  return routes;
}
