
/**
 * Client
**/

import * as runtime from './runtime/client.js';
import $Types = runtime.Types // general types
import $Public = runtime.Types.Public
import $Utils = runtime.Types.Utils
import $Extensions = runtime.Types.Extensions
import $Result = runtime.Types.Result

export type PrismaPromise<T> = $Public.PrismaPromise<T>


/**
 * Model User
 * 
 */
export type User = $Result.DefaultSelection<Prisma.$UserPayload>
/**
 * Model TradeLog
 * 
 */
export type TradeLog = $Result.DefaultSelection<Prisma.$TradeLogPayload>

/**
 * ##  Prisma Client ʲˢ
 *
 * Type-safe database client for TypeScript & Node.js
 * @example
 * ```
 * const prisma = new PrismaClient({
 *   adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL })
 * })
 * // Fetch zero or more Users
 * const users = await prisma.user.findMany()
 * ```
 *
 *
 * Read more in our [docs](https://pris.ly/d/client).
 */
export class PrismaClient<
  ClientOptions extends Prisma.PrismaClientOptions = Prisma.PrismaClientOptions,
  const U = 'log' extends keyof ClientOptions ? ClientOptions['log'] extends Array<Prisma.LogLevel | Prisma.LogDefinition> ? Prisma.GetEvents<ClientOptions['log']> : never : never,
  ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs
> {
  [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['other'] }

    /**
   * ##  Prisma Client ʲˢ
   *
   * Type-safe database client for TypeScript & Node.js
   * @example
   * ```
   * const prisma = new PrismaClient({
   *   adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL })
   * })
   * // Fetch zero or more Users
   * const users = await prisma.user.findMany()
   * ```
   *
   *
   * Read more in our [docs](https://pris.ly/d/client).
   */

  constructor(optionsArg ?: Prisma.Subset<ClientOptions, Prisma.PrismaClientOptions>);
  $on<V extends U>(eventType: V, callback: (event: V extends 'query' ? Prisma.QueryEvent : Prisma.LogEvent) => void): PrismaClient;

  /**
   * Connect with the database
   */
  $connect(): $Utils.JsPromise<void>;

  /**
   * Disconnect from the database
   */
  $disconnect(): $Utils.JsPromise<void>;

/**
   * Executes a prepared raw query and returns the number of affected rows.
   * @example
   * ```
   * const result = await prisma.$executeRaw`UPDATE User SET cool = ${true} WHERE email = ${'user@email.com'};`
   * ```
   *
   * Read more in our [docs](https://pris.ly/d/raw-queries).
   */
  $executeRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Executes a raw query and returns the number of affected rows.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$executeRawUnsafe('UPDATE User SET cool = $1 WHERE email = $2 ;', true, 'user@email.com')
   * ```
   *
   * Read more in our [docs](https://pris.ly/d/raw-queries).
   */
  $executeRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Performs a prepared raw query and returns the `SELECT` data.
   * @example
   * ```
   * const result = await prisma.$queryRaw`SELECT * FROM User WHERE id = ${1} OR email = ${'user@email.com'};`
   * ```
   *
   * Read more in our [docs](https://pris.ly/d/raw-queries).
   */
  $queryRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<T>;

  /**
   * Performs a raw query and returns the `SELECT` data.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$queryRawUnsafe('SELECT * FROM User WHERE id = $1 OR email = $2;', 1, 'user@email.com')
   * ```
   *
   * Read more in our [docs](https://pris.ly/d/raw-queries).
   */
  $queryRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<T>;


  /**
   * Allows the running of a sequence of read/write operations that are guaranteed to either succeed or fail as a whole.
   * @example
   * ```
   * const [george, bob, alice] = await prisma.$transaction([
   *   prisma.user.create({ data: { name: 'George' } }),
   *   prisma.user.create({ data: { name: 'Bob' } }),
   *   prisma.user.create({ data: { name: 'Alice' } }),
   * ])
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/orm/prisma-client/queries/transactions).
   */
  $transaction<P extends Prisma.PrismaPromise<any>[]>(arg: [...P], options?: { isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<runtime.Types.Utils.UnwrapTuple<P>>

  $transaction<R>(fn: (prisma: Omit<PrismaClient, runtime.ITXClientDenyList>) => $Utils.JsPromise<R>, options?: { maxWait?: number, timeout?: number, isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<R>

  $extends: $Extensions.ExtendsHook<"extends", Prisma.TypeMapCb<ClientOptions>, ExtArgs, $Utils.Call<Prisma.TypeMapCb<ClientOptions>, {
    extArgs: ExtArgs
  }>>

      /**
   * `prisma.user`: Exposes CRUD operations for the **User** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Users
    * const users = await prisma.user.findMany()
    * ```
    */
  get user(): Prisma.UserDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.tradeLog`: Exposes CRUD operations for the **TradeLog** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more TradeLogs
    * const tradeLogs = await prisma.tradeLog.findMany()
    * ```
    */
  get tradeLog(): Prisma.TradeLogDelegate<ExtArgs, ClientOptions>;
}

export namespace Prisma {
  export import DMMF = runtime.DMMF

  export type PrismaPromise<T> = $Public.PrismaPromise<T>

  /**
   * Validator
   */
  export import validator = runtime.Public.validator

  /**
   * Prisma Errors
   */
  export import PrismaClientKnownRequestError = runtime.PrismaClientKnownRequestError
  export import PrismaClientUnknownRequestError = runtime.PrismaClientUnknownRequestError
  export import PrismaClientRustPanicError = runtime.PrismaClientRustPanicError
  export import PrismaClientInitializationError = runtime.PrismaClientInitializationError
  export import PrismaClientValidationError = runtime.PrismaClientValidationError

  /**
   * Re-export of sql-template-tag
   */
  export import sql = runtime.sqltag
  export import empty = runtime.empty
  export import join = runtime.join
  export import raw = runtime.raw
  export import Sql = runtime.Sql



  /**
   * Decimal.js
   */
  export import Decimal = runtime.Decimal

  export type DecimalJsLike = runtime.DecimalJsLike

  /**
  * Extensions
  */
  export import Extension = $Extensions.UserArgs
  export import getExtensionContext = runtime.Extensions.getExtensionContext
  export import Args = $Public.Args
  export import Payload = $Public.Payload
  export import Result = $Public.Result
  export import Exact = $Public.Exact

  /**
   * Prisma Client JS version: 7.6.0
   * Query Engine version: 75cbdc1eb7150937890ad5465d861175c6624711
   */
  export type PrismaVersion = {
    client: string
    engine: string
  }

  export const prismaVersion: PrismaVersion

  /**
   * Utility Types
   */


  export import Bytes = runtime.Bytes
  export import JsonObject = runtime.JsonObject
  export import JsonArray = runtime.JsonArray
  export import JsonValue = runtime.JsonValue
  export import InputJsonObject = runtime.InputJsonObject
  export import InputJsonArray = runtime.InputJsonArray
  export import InputJsonValue = runtime.InputJsonValue

  /**
   * Types of the values used to represent different kinds of `null` values when working with JSON fields.
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  namespace NullTypes {
    /**
    * Type of `Prisma.DbNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.DbNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class DbNull {
      private DbNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.JsonNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.JsonNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class JsonNull {
      private JsonNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.AnyNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.AnyNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class AnyNull {
      private AnyNull: never
      private constructor()
    }
  }

  /**
   * Helper for filtering JSON entries that have `null` on the database (empty on the db)
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const DbNull: NullTypes.DbNull

  /**
   * Helper for filtering JSON entries that have JSON `null` values (not empty on the db)
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const JsonNull: NullTypes.JsonNull

  /**
   * Helper for filtering JSON entries that are `Prisma.DbNull` or `Prisma.JsonNull`
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const AnyNull: NullTypes.AnyNull

  type SelectAndInclude = {
    select: any
    include: any
  }

  type SelectAndOmit = {
    select: any
    omit: any
  }

  /**
   * Get the type of the value, that the Promise holds.
   */
  export type PromiseType<T extends PromiseLike<any>> = T extends PromiseLike<infer U> ? U : T;

  /**
   * Get the return type of a function which returns a Promise.
   */
  export type PromiseReturnType<T extends (...args: any) => $Utils.JsPromise<any>> = PromiseType<ReturnType<T>>

  /**
   * From T, pick a set of properties whose keys are in the union K
   */
  type Prisma__Pick<T, K extends keyof T> = {
      [P in K]: T[P];
  };


  export type Enumerable<T> = T | Array<T>;

  export type RequiredKeys<T> = {
    [K in keyof T]-?: {} extends Prisma__Pick<T, K> ? never : K
  }[keyof T]

  export type TruthyKeys<T> = keyof {
    [K in keyof T as T[K] extends false | undefined | null ? never : K]: K
  }

  export type TrueKeys<T> = TruthyKeys<Prisma__Pick<T, RequiredKeys<T>>>

  /**
   * Subset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection
   */
  export type Subset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never;
  };

  /**
   * SelectSubset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection.
   * Additionally, it validates, if both select and include are present. If the case, it errors.
   */
  export type SelectSubset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    (T extends SelectAndInclude
      ? 'Please either choose `select` or `include`.'
      : T extends SelectAndOmit
        ? 'Please either choose `select` or `omit`.'
        : {})

  /**
   * Subset + Intersection
   * @desc From `T` pick properties that exist in `U` and intersect `K`
   */
  export type SubsetIntersection<T, U, K> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    K

  type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };

  /**
   * XOR is needed to have a real mutually exclusive union type
   * https://stackoverflow.com/questions/42123407/does-typescript-support-mutually-exclusive-types
   */
  type XOR<T, U> =
    T extends object ?
    U extends object ?
      (Without<T, U> & U) | (Without<U, T> & T)
    : U : T


  /**
   * Is T a Record?
   */
  type IsObject<T extends any> = T extends Array<any>
  ? False
  : T extends Date
  ? False
  : T extends Uint8Array
  ? False
  : T extends BigInt
  ? False
  : T extends object
  ? True
  : False


  /**
   * If it's T[], return T
   */
  export type UnEnumerate<T extends unknown> = T extends Array<infer U> ? U : T

  /**
   * From ts-toolbelt
   */

  type __Either<O extends object, K extends Key> = Omit<O, K> &
    {
      // Merge all but K
      [P in K]: Prisma__Pick<O, P & keyof O> // With K possibilities
    }[K]

  type EitherStrict<O extends object, K extends Key> = Strict<__Either<O, K>>

  type EitherLoose<O extends object, K extends Key> = ComputeRaw<__Either<O, K>>

  type _Either<
    O extends object,
    K extends Key,
    strict extends Boolean
  > = {
    1: EitherStrict<O, K>
    0: EitherLoose<O, K>
  }[strict]

  type Either<
    O extends object,
    K extends Key,
    strict extends Boolean = 1
  > = O extends unknown ? _Either<O, K, strict> : never

  export type Union = any

  type PatchUndefined<O extends object, O1 extends object> = {
    [K in keyof O]: O[K] extends undefined ? At<O1, K> : O[K]
  } & {}

  /** Helper Types for "Merge" **/
  export type IntersectOf<U extends Union> = (
    U extends unknown ? (k: U) => void : never
  ) extends (k: infer I) => void
    ? I
    : never

  export type Overwrite<O extends object, O1 extends object> = {
      [K in keyof O]: K extends keyof O1 ? O1[K] : O[K];
  } & {};

  type _Merge<U extends object> = IntersectOf<Overwrite<U, {
      [K in keyof U]-?: At<U, K>;
  }>>;

  type Key = string | number | symbol;
  type AtBasic<O extends object, K extends Key> = K extends keyof O ? O[K] : never;
  type AtStrict<O extends object, K extends Key> = O[K & keyof O];
  type AtLoose<O extends object, K extends Key> = O extends unknown ? AtStrict<O, K> : never;
  export type At<O extends object, K extends Key, strict extends Boolean = 1> = {
      1: AtStrict<O, K>;
      0: AtLoose<O, K>;
  }[strict];

  export type ComputeRaw<A extends any> = A extends Function ? A : {
    [K in keyof A]: A[K];
  } & {};

  export type OptionalFlat<O> = {
    [K in keyof O]?: O[K];
  } & {};

  type _Record<K extends keyof any, T> = {
    [P in K]: T;
  };

  // cause typescript not to expand types and preserve names
  type NoExpand<T> = T extends unknown ? T : never;

  // this type assumes the passed object is entirely optional
  type AtLeast<O extends object, K extends string> = NoExpand<
    O extends unknown
    ? | (K extends keyof O ? { [P in K]: O[P] } & O : O)
      | {[P in keyof O as P extends K ? P : never]-?: O[P]} & O
    : never>;

  type _Strict<U, _U = U> = U extends unknown ? U & OptionalFlat<_Record<Exclude<Keys<_U>, keyof U>, never>> : never;

  export type Strict<U extends object> = ComputeRaw<_Strict<U>>;
  /** End Helper Types for "Merge" **/

  export type Merge<U extends object> = ComputeRaw<_Merge<Strict<U>>>;

  /**
  A [[Boolean]]
  */
  export type Boolean = True | False

  // /**
  // 1
  // */
  export type True = 1

  /**
  0
  */
  export type False = 0

  export type Not<B extends Boolean> = {
    0: 1
    1: 0
  }[B]

  export type Extends<A1 extends any, A2 extends any> = [A1] extends [never]
    ? 0 // anything `never` is false
    : A1 extends A2
    ? 1
    : 0

  export type Has<U extends Union, U1 extends Union> = Not<
    Extends<Exclude<U1, U>, U1>
  >

  export type Or<B1 extends Boolean, B2 extends Boolean> = {
    0: {
      0: 0
      1: 1
    }
    1: {
      0: 1
      1: 1
    }
  }[B1][B2]

  export type Keys<U extends Union> = U extends unknown ? keyof U : never

  type Cast<A, B> = A extends B ? A : B;

  export const type: unique symbol;



  /**
   * Used by group by
   */

  export type GetScalarType<T, O> = O extends object ? {
    [P in keyof T]: P extends keyof O
      ? O[P]
      : never
  } : never

  type FieldPaths<
    T,
    U = Omit<T, '_avg' | '_sum' | '_count' | '_min' | '_max'>
  > = IsObject<T> extends True ? U : T

  type GetHavingFields<T> = {
    [K in keyof T]: Or<
      Or<Extends<'OR', K>, Extends<'AND', K>>,
      Extends<'NOT', K>
    > extends True
      ? // infer is only needed to not hit TS limit
        // based on the brilliant idea of Pierre-Antoine Mills
        // https://github.com/microsoft/TypeScript/issues/30188#issuecomment-478938437
        T[K] extends infer TK
        ? GetHavingFields<UnEnumerate<TK> extends object ? Merge<UnEnumerate<TK>> : never>
        : never
      : {} extends FieldPaths<T[K]>
      ? never
      : K
  }[keyof T]

  /**
   * Convert tuple to union
   */
  type _TupleToUnion<T> = T extends (infer E)[] ? E : never
  type TupleToUnion<K extends readonly any[]> = _TupleToUnion<K>
  type MaybeTupleToUnion<T> = T extends any[] ? TupleToUnion<T> : T

  /**
   * Like `Pick`, but additionally can also accept an array of keys
   */
  type PickEnumerable<T, K extends Enumerable<keyof T> | keyof T> = Prisma__Pick<T, MaybeTupleToUnion<K>>

  /**
   * Exclude all keys with underscores
   */
  type ExcludeUnderscoreKeys<T extends string> = T extends `_${string}` ? never : T


  export type FieldRef<Model, FieldType> = runtime.FieldRef<Model, FieldType>

  type FieldRefInputType<Model, FieldType> = Model extends never ? never : FieldRef<Model, FieldType>


  export const ModelName: {
    User: 'User',
    TradeLog: 'TradeLog'
  };

  export type ModelName = (typeof ModelName)[keyof typeof ModelName]



  interface TypeMapCb<ClientOptions = {}> extends $Utils.Fn<{extArgs: $Extensions.InternalArgs }, $Utils.Record<string, any>> {
    returns: Prisma.TypeMap<this['params']['extArgs'], ClientOptions extends { omit: infer OmitOptions } ? OmitOptions : {}>
  }

  export type TypeMap<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> = {
    globalOmitOptions: {
      omit: GlobalOmitOptions
    }
    meta: {
      modelProps: "user" | "tradeLog"
      txIsolationLevel: Prisma.TransactionIsolationLevel
    }
    model: {
      User: {
        payload: Prisma.$UserPayload<ExtArgs>
        fields: Prisma.UserFieldRefs
        operations: {
          findUnique: {
            args: Prisma.UserFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.UserFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          findFirst: {
            args: Prisma.UserFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.UserFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          findMany: {
            args: Prisma.UserFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>[]
          }
          create: {
            args: Prisma.UserCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          createMany: {
            args: Prisma.UserCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.UserCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>[]
          }
          delete: {
            args: Prisma.UserDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          update: {
            args: Prisma.UserUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          deleteMany: {
            args: Prisma.UserDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.UserUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.UserUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>[]
          }
          upsert: {
            args: Prisma.UserUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          aggregate: {
            args: Prisma.UserAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateUser>
          }
          groupBy: {
            args: Prisma.UserGroupByArgs<ExtArgs>
            result: $Utils.Optional<UserGroupByOutputType>[]
          }
          count: {
            args: Prisma.UserCountArgs<ExtArgs>
            result: $Utils.Optional<UserCountAggregateOutputType> | number
          }
        }
      }
      TradeLog: {
        payload: Prisma.$TradeLogPayload<ExtArgs>
        fields: Prisma.TradeLogFieldRefs
        operations: {
          findUnique: {
            args: Prisma.TradeLogFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TradeLogPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.TradeLogFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TradeLogPayload>
          }
          findFirst: {
            args: Prisma.TradeLogFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TradeLogPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.TradeLogFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TradeLogPayload>
          }
          findMany: {
            args: Prisma.TradeLogFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TradeLogPayload>[]
          }
          create: {
            args: Prisma.TradeLogCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TradeLogPayload>
          }
          createMany: {
            args: Prisma.TradeLogCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.TradeLogCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TradeLogPayload>[]
          }
          delete: {
            args: Prisma.TradeLogDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TradeLogPayload>
          }
          update: {
            args: Prisma.TradeLogUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TradeLogPayload>
          }
          deleteMany: {
            args: Prisma.TradeLogDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.TradeLogUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.TradeLogUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TradeLogPayload>[]
          }
          upsert: {
            args: Prisma.TradeLogUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TradeLogPayload>
          }
          aggregate: {
            args: Prisma.TradeLogAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateTradeLog>
          }
          groupBy: {
            args: Prisma.TradeLogGroupByArgs<ExtArgs>
            result: $Utils.Optional<TradeLogGroupByOutputType>[]
          }
          count: {
            args: Prisma.TradeLogCountArgs<ExtArgs>
            result: $Utils.Optional<TradeLogCountAggregateOutputType> | number
          }
        }
      }
    }
  } & {
    other: {
      payload: any
      operations: {
        $executeRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $executeRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
        $queryRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $queryRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
      }
    }
  }
  export const defineExtension: $Extensions.ExtendsHook<"define", Prisma.TypeMapCb, $Extensions.DefaultArgs>
  export type DefaultPrismaClient = PrismaClient
  export type ErrorFormat = 'pretty' | 'colorless' | 'minimal'
  export interface PrismaClientOptions {
    /**
     * @default "colorless"
     */
    errorFormat?: ErrorFormat
    /**
     * @example
     * ```
     * // Shorthand for `emit: 'stdout'`
     * log: ['query', 'info', 'warn', 'error']
     * 
     * // Emit as events only
     * log: [
     *   { emit: 'event', level: 'query' },
     *   { emit: 'event', level: 'info' },
     *   { emit: 'event', level: 'warn' }
     *   { emit: 'event', level: 'error' }
     * ]
     * 
     * / Emit as events and log to stdout
     * og: [
     *  { emit: 'stdout', level: 'query' },
     *  { emit: 'stdout', level: 'info' },
     *  { emit: 'stdout', level: 'warn' }
     *  { emit: 'stdout', level: 'error' }
     * 
     * ```
     * Read more in our [docs](https://pris.ly/d/logging).
     */
    log?: (LogLevel | LogDefinition)[]
    /**
     * The default values for transactionOptions
     * maxWait ?= 2000
     * timeout ?= 5000
     */
    transactionOptions?: {
      maxWait?: number
      timeout?: number
      isolationLevel?: Prisma.TransactionIsolationLevel
    }
    /**
     * Instance of a Driver Adapter, e.g., like one provided by `@prisma/adapter-planetscale`
     */
    adapter?: runtime.SqlDriverAdapterFactory
    /**
     * Prisma Accelerate URL allowing the client to connect through Accelerate instead of a direct database.
     */
    accelerateUrl?: string
    /**
     * Global configuration for omitting model fields by default.
     * 
     * @example
     * ```
     * const prisma = new PrismaClient({
     *   omit: {
     *     user: {
     *       password: true
     *     }
     *   }
     * })
     * ```
     */
    omit?: Prisma.GlobalOmitConfig
    /**
     * SQL commenter plugins that add metadata to SQL queries as comments.
     * Comments follow the sqlcommenter format: https://google.github.io/sqlcommenter/
     * 
     * @example
     * ```
     * const prisma = new PrismaClient({
     *   adapter,
     *   comments: [
     *     traceContext(),
     *     queryInsights(),
     *   ],
     * })
     * ```
     */
    comments?: runtime.SqlCommenterPlugin[]
  }
  export type GlobalOmitConfig = {
    user?: UserOmit
    tradeLog?: TradeLogOmit
  }

  /* Types for Logging */
  export type LogLevel = 'info' | 'query' | 'warn' | 'error'
  export type LogDefinition = {
    level: LogLevel
    emit: 'stdout' | 'event'
  }

  export type CheckIsLogLevel<T> = T extends LogLevel ? T : never;

  export type GetLogType<T> = CheckIsLogLevel<
    T extends LogDefinition ? T['level'] : T
  >;

  export type GetEvents<T extends any[]> = T extends Array<LogLevel | LogDefinition>
    ? GetLogType<T[number]>
    : never;

  export type QueryEvent = {
    timestamp: Date
    query: string
    params: string
    duration: number
    target: string
  }

  export type LogEvent = {
    timestamp: Date
    message: string
    target: string
  }
  /* End Types for Logging */


  export type PrismaAction =
    | 'findUnique'
    | 'findUniqueOrThrow'
    | 'findMany'
    | 'findFirst'
    | 'findFirstOrThrow'
    | 'create'
    | 'createMany'
    | 'createManyAndReturn'
    | 'update'
    | 'updateMany'
    | 'updateManyAndReturn'
    | 'upsert'
    | 'delete'
    | 'deleteMany'
    | 'executeRaw'
    | 'queryRaw'
    | 'aggregate'
    | 'count'
    | 'runCommandRaw'
    | 'findRaw'
    | 'groupBy'

  // tested in getLogLevel.test.ts
  export function getLogLevel(log: Array<LogLevel | LogDefinition>): LogLevel | undefined;

  /**
   * `PrismaClient` proxy available in interactive transactions.
   */
  export type TransactionClient = Omit<Prisma.DefaultPrismaClient, runtime.ITXClientDenyList>

  export type Datasource = {
    url?: string
  }

  /**
   * Count Types
   */


  /**
   * Count Type UserCountOutputType
   */

  export type UserCountOutputType = {
    logs: number
  }

  export type UserCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    logs?: boolean | UserCountOutputTypeCountLogsArgs
  }

  // Custom InputTypes
  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserCountOutputType
     */
    select?: UserCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeCountLogsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: TradeLogWhereInput
  }


  /**
   * Models
   */

  /**
   * Model User
   */

  export type AggregateUser = {
    _count: UserCountAggregateOutputType | null
    _min: UserMinAggregateOutputType | null
    _max: UserMaxAggregateOutputType | null
  }

  export type UserMinAggregateOutputType = {
    id: string | null
    email: string | null
    passwordHash: string | null
    createdAt: Date | null
    updatedAt: Date | null
    stripeCustomerId: string | null
    stripeSubId: string | null
    stripePriceId: string | null
    billingStatus: string | null
    billingPlan: string | null
    billingPeriodEnd: Date | null
    isActive: boolean | null
  }

  export type UserMaxAggregateOutputType = {
    id: string | null
    email: string | null
    passwordHash: string | null
    createdAt: Date | null
    updatedAt: Date | null
    stripeCustomerId: string | null
    stripeSubId: string | null
    stripePriceId: string | null
    billingStatus: string | null
    billingPlan: string | null
    billingPeriodEnd: Date | null
    isActive: boolean | null
  }

  export type UserCountAggregateOutputType = {
    id: number
    email: number
    passwordHash: number
    createdAt: number
    updatedAt: number
    stripeCustomerId: number
    stripeSubId: number
    stripePriceId: number
    billingStatus: number
    billingPlan: number
    billingPeriodEnd: number
    isActive: number
    _all: number
  }


  export type UserMinAggregateInputType = {
    id?: true
    email?: true
    passwordHash?: true
    createdAt?: true
    updatedAt?: true
    stripeCustomerId?: true
    stripeSubId?: true
    stripePriceId?: true
    billingStatus?: true
    billingPlan?: true
    billingPeriodEnd?: true
    isActive?: true
  }

  export type UserMaxAggregateInputType = {
    id?: true
    email?: true
    passwordHash?: true
    createdAt?: true
    updatedAt?: true
    stripeCustomerId?: true
    stripeSubId?: true
    stripePriceId?: true
    billingStatus?: true
    billingPlan?: true
    billingPeriodEnd?: true
    isActive?: true
  }

  export type UserCountAggregateInputType = {
    id?: true
    email?: true
    passwordHash?: true
    createdAt?: true
    updatedAt?: true
    stripeCustomerId?: true
    stripeSubId?: true
    stripePriceId?: true
    billingStatus?: true
    billingPlan?: true
    billingPeriodEnd?: true
    isActive?: true
    _all?: true
  }

  export type UserAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which User to aggregate.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Users
    **/
    _count?: true | UserCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: UserMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: UserMaxAggregateInputType
  }

  export type GetUserAggregateType<T extends UserAggregateArgs> = {
        [P in keyof T & keyof AggregateUser]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateUser[P]>
      : GetScalarType<T[P], AggregateUser[P]>
  }




  export type UserGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: UserWhereInput
    orderBy?: UserOrderByWithAggregationInput | UserOrderByWithAggregationInput[]
    by: UserScalarFieldEnum[] | UserScalarFieldEnum
    having?: UserScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: UserCountAggregateInputType | true
    _min?: UserMinAggregateInputType
    _max?: UserMaxAggregateInputType
  }

  export type UserGroupByOutputType = {
    id: string
    email: string
    passwordHash: string
    createdAt: Date
    updatedAt: Date
    stripeCustomerId: string | null
    stripeSubId: string | null
    stripePriceId: string | null
    billingStatus: string | null
    billingPlan: string | null
    billingPeriodEnd: Date | null
    isActive: boolean
    _count: UserCountAggregateOutputType | null
    _min: UserMinAggregateOutputType | null
    _max: UserMaxAggregateOutputType | null
  }

  type GetUserGroupByPayload<T extends UserGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<UserGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof UserGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], UserGroupByOutputType[P]>
            : GetScalarType<T[P], UserGroupByOutputType[P]>
        }
      >
    >


  export type UserSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    email?: boolean
    passwordHash?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    stripeCustomerId?: boolean
    stripeSubId?: boolean
    stripePriceId?: boolean
    billingStatus?: boolean
    billingPlan?: boolean
    billingPeriodEnd?: boolean
    isActive?: boolean
    logs?: boolean | User$logsArgs<ExtArgs>
    _count?: boolean | UserCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["user"]>

  export type UserSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    email?: boolean
    passwordHash?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    stripeCustomerId?: boolean
    stripeSubId?: boolean
    stripePriceId?: boolean
    billingStatus?: boolean
    billingPlan?: boolean
    billingPeriodEnd?: boolean
    isActive?: boolean
  }, ExtArgs["result"]["user"]>

  export type UserSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    email?: boolean
    passwordHash?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    stripeCustomerId?: boolean
    stripeSubId?: boolean
    stripePriceId?: boolean
    billingStatus?: boolean
    billingPlan?: boolean
    billingPeriodEnd?: boolean
    isActive?: boolean
  }, ExtArgs["result"]["user"]>

  export type UserSelectScalar = {
    id?: boolean
    email?: boolean
    passwordHash?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    stripeCustomerId?: boolean
    stripeSubId?: boolean
    stripePriceId?: boolean
    billingStatus?: boolean
    billingPlan?: boolean
    billingPeriodEnd?: boolean
    isActive?: boolean
  }

  export type UserOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "email" | "passwordHash" | "createdAt" | "updatedAt" | "stripeCustomerId" | "stripeSubId" | "stripePriceId" | "billingStatus" | "billingPlan" | "billingPeriodEnd" | "isActive", ExtArgs["result"]["user"]>
  export type UserInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    logs?: boolean | User$logsArgs<ExtArgs>
    _count?: boolean | UserCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type UserIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}
  export type UserIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}

  export type $UserPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "User"
    objects: {
      logs: Prisma.$TradeLogPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      email: string
      passwordHash: string
      createdAt: Date
      updatedAt: Date
      stripeCustomerId: string | null
      stripeSubId: string | null
      stripePriceId: string | null
      billingStatus: string | null
      billingPlan: string | null
      billingPeriodEnd: Date | null
      isActive: boolean
    }, ExtArgs["result"]["user"]>
    composites: {}
  }

  type UserGetPayload<S extends boolean | null | undefined | UserDefaultArgs> = $Result.GetResult<Prisma.$UserPayload, S>

  type UserCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<UserFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: UserCountAggregateInputType | true
    }

  export interface UserDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['User'], meta: { name: 'User' } }
    /**
     * Find zero or one User that matches the filter.
     * @param {UserFindUniqueArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends UserFindUniqueArgs>(args: SelectSubset<T, UserFindUniqueArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one User that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {UserFindUniqueOrThrowArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends UserFindUniqueOrThrowArgs>(args: SelectSubset<T, UserFindUniqueOrThrowArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first User that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserFindFirstArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends UserFindFirstArgs>(args?: SelectSubset<T, UserFindFirstArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first User that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserFindFirstOrThrowArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends UserFindFirstOrThrowArgs>(args?: SelectSubset<T, UserFindFirstOrThrowArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Users that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Users
     * const users = await prisma.user.findMany()
     * 
     * // Get first 10 Users
     * const users = await prisma.user.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const userWithIdOnly = await prisma.user.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends UserFindManyArgs>(args?: SelectSubset<T, UserFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a User.
     * @param {UserCreateArgs} args - Arguments to create a User.
     * @example
     * // Create one User
     * const User = await prisma.user.create({
     *   data: {
     *     // ... data to create a User
     *   }
     * })
     * 
     */
    create<T extends UserCreateArgs>(args: SelectSubset<T, UserCreateArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Users.
     * @param {UserCreateManyArgs} args - Arguments to create many Users.
     * @example
     * // Create many Users
     * const user = await prisma.user.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends UserCreateManyArgs>(args?: SelectSubset<T, UserCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Users and returns the data saved in the database.
     * @param {UserCreateManyAndReturnArgs} args - Arguments to create many Users.
     * @example
     * // Create many Users
     * const user = await prisma.user.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Users and only return the `id`
     * const userWithIdOnly = await prisma.user.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends UserCreateManyAndReturnArgs>(args?: SelectSubset<T, UserCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a User.
     * @param {UserDeleteArgs} args - Arguments to delete one User.
     * @example
     * // Delete one User
     * const User = await prisma.user.delete({
     *   where: {
     *     // ... filter to delete one User
     *   }
     * })
     * 
     */
    delete<T extends UserDeleteArgs>(args: SelectSubset<T, UserDeleteArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one User.
     * @param {UserUpdateArgs} args - Arguments to update one User.
     * @example
     * // Update one User
     * const user = await prisma.user.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends UserUpdateArgs>(args: SelectSubset<T, UserUpdateArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Users.
     * @param {UserDeleteManyArgs} args - Arguments to filter Users to delete.
     * @example
     * // Delete a few Users
     * const { count } = await prisma.user.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends UserDeleteManyArgs>(args?: SelectSubset<T, UserDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Users.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Users
     * const user = await prisma.user.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends UserUpdateManyArgs>(args: SelectSubset<T, UserUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Users and returns the data updated in the database.
     * @param {UserUpdateManyAndReturnArgs} args - Arguments to update many Users.
     * @example
     * // Update many Users
     * const user = await prisma.user.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Users and only return the `id`
     * const userWithIdOnly = await prisma.user.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends UserUpdateManyAndReturnArgs>(args: SelectSubset<T, UserUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one User.
     * @param {UserUpsertArgs} args - Arguments to update or create a User.
     * @example
     * // Update or create a User
     * const user = await prisma.user.upsert({
     *   create: {
     *     // ... data to create a User
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the User we want to update
     *   }
     * })
     */
    upsert<T extends UserUpsertArgs>(args: SelectSubset<T, UserUpsertArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Users.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserCountArgs} args - Arguments to filter Users to count.
     * @example
     * // Count the number of Users
     * const count = await prisma.user.count({
     *   where: {
     *     // ... the filter for the Users we want to count
     *   }
     * })
    **/
    count<T extends UserCountArgs>(
      args?: Subset<T, UserCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], UserCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a User.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends UserAggregateArgs>(args: Subset<T, UserAggregateArgs>): Prisma.PrismaPromise<GetUserAggregateType<T>>

    /**
     * Group by User.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends UserGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: UserGroupByArgs['orderBy'] }
        : { orderBy?: UserGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, UserGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetUserGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the User model
   */
  readonly fields: UserFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for User.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__UserClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    logs<T extends User$logsArgs<ExtArgs> = {}>(args?: Subset<T, User$logsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TradeLogPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the User model
   */
  interface UserFieldRefs {
    readonly id: FieldRef<"User", 'String'>
    readonly email: FieldRef<"User", 'String'>
    readonly passwordHash: FieldRef<"User", 'String'>
    readonly createdAt: FieldRef<"User", 'DateTime'>
    readonly updatedAt: FieldRef<"User", 'DateTime'>
    readonly stripeCustomerId: FieldRef<"User", 'String'>
    readonly stripeSubId: FieldRef<"User", 'String'>
    readonly stripePriceId: FieldRef<"User", 'String'>
    readonly billingStatus: FieldRef<"User", 'String'>
    readonly billingPlan: FieldRef<"User", 'String'>
    readonly billingPeriodEnd: FieldRef<"User", 'DateTime'>
    readonly isActive: FieldRef<"User", 'Boolean'>
  }
    

  // Custom InputTypes
  /**
   * User findUnique
   */
  export type UserFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where: UserWhereUniqueInput
  }

  /**
   * User findUniqueOrThrow
   */
  export type UserFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where: UserWhereUniqueInput
  }

  /**
   * User findFirst
   */
  export type UserFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Users.
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Users.
     */
    distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
  }

  /**
   * User findFirstOrThrow
   */
  export type UserFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Users.
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Users.
     */
    distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
  }

  /**
   * User findMany
   */
  export type UserFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which Users to fetch.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Users.
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Users.
     */
    distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
  }

  /**
   * User create
   */
  export type UserCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * The data needed to create a User.
     */
    data: XOR<UserCreateInput, UserUncheckedCreateInput>
  }

  /**
   * User createMany
   */
  export type UserCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Users.
     */
    data: UserCreateManyInput | UserCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * User createManyAndReturn
   */
  export type UserCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * The data used to create many Users.
     */
    data: UserCreateManyInput | UserCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * User update
   */
  export type UserUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * The data needed to update a User.
     */
    data: XOR<UserUpdateInput, UserUncheckedUpdateInput>
    /**
     * Choose, which User to update.
     */
    where: UserWhereUniqueInput
  }

  /**
   * User updateMany
   */
  export type UserUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Users.
     */
    data: XOR<UserUpdateManyMutationInput, UserUncheckedUpdateManyInput>
    /**
     * Filter which Users to update
     */
    where?: UserWhereInput
    /**
     * Limit how many Users to update.
     */
    limit?: number
  }

  /**
   * User updateManyAndReturn
   */
  export type UserUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * The data used to update Users.
     */
    data: XOR<UserUpdateManyMutationInput, UserUncheckedUpdateManyInput>
    /**
     * Filter which Users to update
     */
    where?: UserWhereInput
    /**
     * Limit how many Users to update.
     */
    limit?: number
  }

  /**
   * User upsert
   */
  export type UserUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * The filter to search for the User to update in case it exists.
     */
    where: UserWhereUniqueInput
    /**
     * In case the User found by the `where` argument doesn't exist, create a new User with this data.
     */
    create: XOR<UserCreateInput, UserUncheckedCreateInput>
    /**
     * In case the User was found with the provided `where` argument, update it with this data.
     */
    update: XOR<UserUpdateInput, UserUncheckedUpdateInput>
  }

  /**
   * User delete
   */
  export type UserDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter which User to delete.
     */
    where: UserWhereUniqueInput
  }

  /**
   * User deleteMany
   */
  export type UserDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Users to delete
     */
    where?: UserWhereInput
    /**
     * Limit how many Users to delete.
     */
    limit?: number
  }

  /**
   * User.logs
   */
  export type User$logsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TradeLog
     */
    select?: TradeLogSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TradeLog
     */
    omit?: TradeLogOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TradeLogInclude<ExtArgs> | null
    where?: TradeLogWhereInput
    orderBy?: TradeLogOrderByWithRelationInput | TradeLogOrderByWithRelationInput[]
    cursor?: TradeLogWhereUniqueInput
    take?: number
    skip?: number
    distinct?: TradeLogScalarFieldEnum | TradeLogScalarFieldEnum[]
  }

  /**
   * User without action
   */
  export type UserDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
  }


  /**
   * Model TradeLog
   */

  export type AggregateTradeLog = {
    _count: TradeLogCountAggregateOutputType | null
    _avg: TradeLogAvgAggregateOutputType | null
    _sum: TradeLogSumAggregateOutputType | null
    _min: TradeLogMinAggregateOutputType | null
    _max: TradeLogMaxAggregateOutputType | null
  }

  export type TradeLogAvgAggregateOutputType = {
    pnl: number | null
    leverage: number | null
    entry: number | null
    stop: number | null
    tp1: number | null
    tp2: number | null
    rr1: number | null
    rr2: number | null
    confidenceSelf: number | null
    durationMinutes: number | null
    emotionalPressure: number | null
    setupQuality: number | null
    disciplineScore: number | null
    aiScore: number | null
    setupScore: number | null
    executionScore: number | null
    managementScore: number | null
    disciplineScoreAi: number | null
    aiConfidence: number | null
  }

  export type TradeLogSumAggregateOutputType = {
    pnl: number | null
    leverage: number | null
    entry: number | null
    stop: number | null
    tp1: number | null
    tp2: number | null
    rr1: number | null
    rr2: number | null
    confidenceSelf: number | null
    durationMinutes: number | null
    emotionalPressure: number | null
    setupQuality: number | null
    disciplineScore: number | null
    aiScore: number | null
    setupScore: number | null
    executionScore: number | null
    managementScore: number | null
    disciplineScoreAi: number | null
    aiConfidence: number | null
  }

  export type TradeLogMinAggregateOutputType = {
    id: string | null
    userId: string | null
    pair: string | null
    timeframe: string | null
    session: string | null
    action: string | null
    pnl: number | null
    notes: string | null
    leverage: number | null
    entry: number | null
    stop: number | null
    tp1: number | null
    tp2: number | null
    rr1: number | null
    rr2: number | null
    directionBias: string | null
    eventType: string | null
    sweepType: string | null
    emaContext: string | null
    reclaimConfirmed: boolean | null
    planFollowed: string | null
    ruleBreak: string | null
    executionType: string | null
    liquidityLevel: string | null
    htfBias: string | null
    entryTrigger: string | null
    outcome: string | null
    confidenceSelf: number | null
    durationMinutes: number | null
    emotionalPressure: number | null
    setupQuality: number | null
    disciplineScore: number | null
    linkedEventId: string | null
    screenshotUrl: string | null
    aiScore: number | null
    aiGrade: string | null
    aiSummary: string | null
    aiCoachingNote: string | null
    aiStatus: string | null
    setupScore: number | null
    executionScore: number | null
    managementScore: number | null
    disciplineScoreAi: number | null
    aiConfidence: number | null
    chartRead: string | null
    setupAssessment: string | null
    executionAssessment: string | null
    riskAssessment: string | null
    biasAlignment: string | null
    usedScreenshot: boolean | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type TradeLogMaxAggregateOutputType = {
    id: string | null
    userId: string | null
    pair: string | null
    timeframe: string | null
    session: string | null
    action: string | null
    pnl: number | null
    notes: string | null
    leverage: number | null
    entry: number | null
    stop: number | null
    tp1: number | null
    tp2: number | null
    rr1: number | null
    rr2: number | null
    directionBias: string | null
    eventType: string | null
    sweepType: string | null
    emaContext: string | null
    reclaimConfirmed: boolean | null
    planFollowed: string | null
    ruleBreak: string | null
    executionType: string | null
    liquidityLevel: string | null
    htfBias: string | null
    entryTrigger: string | null
    outcome: string | null
    confidenceSelf: number | null
    durationMinutes: number | null
    emotionalPressure: number | null
    setupQuality: number | null
    disciplineScore: number | null
    linkedEventId: string | null
    screenshotUrl: string | null
    aiScore: number | null
    aiGrade: string | null
    aiSummary: string | null
    aiCoachingNote: string | null
    aiStatus: string | null
    setupScore: number | null
    executionScore: number | null
    managementScore: number | null
    disciplineScoreAi: number | null
    aiConfidence: number | null
    chartRead: string | null
    setupAssessment: string | null
    executionAssessment: string | null
    riskAssessment: string | null
    biasAlignment: string | null
    usedScreenshot: boolean | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type TradeLogCountAggregateOutputType = {
    id: number
    userId: number
    pair: number
    timeframe: number
    session: number
    action: number
    pnl: number
    notes: number
    leverage: number
    entry: number
    stop: number
    tp1: number
    tp2: number
    rr1: number
    rr2: number
    directionBias: number
    eventType: number
    sweepType: number
    emaContext: number
    reclaimConfirmed: number
    planFollowed: number
    ruleBreak: number
    executionType: number
    liquidityLevel: number
    htfBias: number
    entryTrigger: number
    outcome: number
    confidenceSelf: number
    durationMinutes: number
    emotionalPressure: number
    setupQuality: number
    disciplineScore: number
    linkedEventId: number
    screenshotUrl: number
    aiScore: number
    aiGrade: number
    aiSummary: number
    aiCoachingNote: number
    aiStatus: number
    setupScore: number
    executionScore: number
    managementScore: number
    disciplineScoreAi: number
    aiConfidence: number
    chartRead: number
    setupAssessment: number
    executionAssessment: number
    riskAssessment: number
    biasAlignment: number
    mistakeTags: number
    whatWasGood: number
    whatNeedsWork: number
    usedScreenshot: number
    aiPayload: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type TradeLogAvgAggregateInputType = {
    pnl?: true
    leverage?: true
    entry?: true
    stop?: true
    tp1?: true
    tp2?: true
    rr1?: true
    rr2?: true
    confidenceSelf?: true
    durationMinutes?: true
    emotionalPressure?: true
    setupQuality?: true
    disciplineScore?: true
    aiScore?: true
    setupScore?: true
    executionScore?: true
    managementScore?: true
    disciplineScoreAi?: true
    aiConfidence?: true
  }

  export type TradeLogSumAggregateInputType = {
    pnl?: true
    leverage?: true
    entry?: true
    stop?: true
    tp1?: true
    tp2?: true
    rr1?: true
    rr2?: true
    confidenceSelf?: true
    durationMinutes?: true
    emotionalPressure?: true
    setupQuality?: true
    disciplineScore?: true
    aiScore?: true
    setupScore?: true
    executionScore?: true
    managementScore?: true
    disciplineScoreAi?: true
    aiConfidence?: true
  }

  export type TradeLogMinAggregateInputType = {
    id?: true
    userId?: true
    pair?: true
    timeframe?: true
    session?: true
    action?: true
    pnl?: true
    notes?: true
    leverage?: true
    entry?: true
    stop?: true
    tp1?: true
    tp2?: true
    rr1?: true
    rr2?: true
    directionBias?: true
    eventType?: true
    sweepType?: true
    emaContext?: true
    reclaimConfirmed?: true
    planFollowed?: true
    ruleBreak?: true
    executionType?: true
    liquidityLevel?: true
    htfBias?: true
    entryTrigger?: true
    outcome?: true
    confidenceSelf?: true
    durationMinutes?: true
    emotionalPressure?: true
    setupQuality?: true
    disciplineScore?: true
    linkedEventId?: true
    screenshotUrl?: true
    aiScore?: true
    aiGrade?: true
    aiSummary?: true
    aiCoachingNote?: true
    aiStatus?: true
    setupScore?: true
    executionScore?: true
    managementScore?: true
    disciplineScoreAi?: true
    aiConfidence?: true
    chartRead?: true
    setupAssessment?: true
    executionAssessment?: true
    riskAssessment?: true
    biasAlignment?: true
    usedScreenshot?: true
    createdAt?: true
    updatedAt?: true
  }

  export type TradeLogMaxAggregateInputType = {
    id?: true
    userId?: true
    pair?: true
    timeframe?: true
    session?: true
    action?: true
    pnl?: true
    notes?: true
    leverage?: true
    entry?: true
    stop?: true
    tp1?: true
    tp2?: true
    rr1?: true
    rr2?: true
    directionBias?: true
    eventType?: true
    sweepType?: true
    emaContext?: true
    reclaimConfirmed?: true
    planFollowed?: true
    ruleBreak?: true
    executionType?: true
    liquidityLevel?: true
    htfBias?: true
    entryTrigger?: true
    outcome?: true
    confidenceSelf?: true
    durationMinutes?: true
    emotionalPressure?: true
    setupQuality?: true
    disciplineScore?: true
    linkedEventId?: true
    screenshotUrl?: true
    aiScore?: true
    aiGrade?: true
    aiSummary?: true
    aiCoachingNote?: true
    aiStatus?: true
    setupScore?: true
    executionScore?: true
    managementScore?: true
    disciplineScoreAi?: true
    aiConfidence?: true
    chartRead?: true
    setupAssessment?: true
    executionAssessment?: true
    riskAssessment?: true
    biasAlignment?: true
    usedScreenshot?: true
    createdAt?: true
    updatedAt?: true
  }

  export type TradeLogCountAggregateInputType = {
    id?: true
    userId?: true
    pair?: true
    timeframe?: true
    session?: true
    action?: true
    pnl?: true
    notes?: true
    leverage?: true
    entry?: true
    stop?: true
    tp1?: true
    tp2?: true
    rr1?: true
    rr2?: true
    directionBias?: true
    eventType?: true
    sweepType?: true
    emaContext?: true
    reclaimConfirmed?: true
    planFollowed?: true
    ruleBreak?: true
    executionType?: true
    liquidityLevel?: true
    htfBias?: true
    entryTrigger?: true
    outcome?: true
    confidenceSelf?: true
    durationMinutes?: true
    emotionalPressure?: true
    setupQuality?: true
    disciplineScore?: true
    linkedEventId?: true
    screenshotUrl?: true
    aiScore?: true
    aiGrade?: true
    aiSummary?: true
    aiCoachingNote?: true
    aiStatus?: true
    setupScore?: true
    executionScore?: true
    managementScore?: true
    disciplineScoreAi?: true
    aiConfidence?: true
    chartRead?: true
    setupAssessment?: true
    executionAssessment?: true
    riskAssessment?: true
    biasAlignment?: true
    mistakeTags?: true
    whatWasGood?: true
    whatNeedsWork?: true
    usedScreenshot?: true
    aiPayload?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type TradeLogAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which TradeLog to aggregate.
     */
    where?: TradeLogWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of TradeLogs to fetch.
     */
    orderBy?: TradeLogOrderByWithRelationInput | TradeLogOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: TradeLogWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` TradeLogs from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` TradeLogs.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned TradeLogs
    **/
    _count?: true | TradeLogCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: TradeLogAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: TradeLogSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: TradeLogMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: TradeLogMaxAggregateInputType
  }

  export type GetTradeLogAggregateType<T extends TradeLogAggregateArgs> = {
        [P in keyof T & keyof AggregateTradeLog]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateTradeLog[P]>
      : GetScalarType<T[P], AggregateTradeLog[P]>
  }




  export type TradeLogGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: TradeLogWhereInput
    orderBy?: TradeLogOrderByWithAggregationInput | TradeLogOrderByWithAggregationInput[]
    by: TradeLogScalarFieldEnum[] | TradeLogScalarFieldEnum
    having?: TradeLogScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: TradeLogCountAggregateInputType | true
    _avg?: TradeLogAvgAggregateInputType
    _sum?: TradeLogSumAggregateInputType
    _min?: TradeLogMinAggregateInputType
    _max?: TradeLogMaxAggregateInputType
  }

  export type TradeLogGroupByOutputType = {
    id: string
    userId: string
    pair: string | null
    timeframe: string | null
    session: string | null
    action: string | null
    pnl: number | null
    notes: string | null
    leverage: number | null
    entry: number | null
    stop: number | null
    tp1: number | null
    tp2: number | null
    rr1: number | null
    rr2: number | null
    directionBias: string | null
    eventType: string | null
    sweepType: string | null
    emaContext: string | null
    reclaimConfirmed: boolean | null
    planFollowed: string | null
    ruleBreak: string | null
    executionType: string | null
    liquidityLevel: string | null
    htfBias: string | null
    entryTrigger: string | null
    outcome: string | null
    confidenceSelf: number | null
    durationMinutes: number | null
    emotionalPressure: number | null
    setupQuality: number | null
    disciplineScore: number | null
    linkedEventId: string | null
    screenshotUrl: string | null
    aiScore: number | null
    aiGrade: string | null
    aiSummary: string | null
    aiCoachingNote: string | null
    aiStatus: string | null
    setupScore: number | null
    executionScore: number | null
    managementScore: number | null
    disciplineScoreAi: number | null
    aiConfidence: number | null
    chartRead: string | null
    setupAssessment: string | null
    executionAssessment: string | null
    riskAssessment: string | null
    biasAlignment: string | null
    mistakeTags: JsonValue | null
    whatWasGood: JsonValue | null
    whatNeedsWork: JsonValue | null
    usedScreenshot: boolean | null
    aiPayload: JsonValue | null
    createdAt: Date
    updatedAt: Date
    _count: TradeLogCountAggregateOutputType | null
    _avg: TradeLogAvgAggregateOutputType | null
    _sum: TradeLogSumAggregateOutputType | null
    _min: TradeLogMinAggregateOutputType | null
    _max: TradeLogMaxAggregateOutputType | null
  }

  type GetTradeLogGroupByPayload<T extends TradeLogGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<TradeLogGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof TradeLogGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], TradeLogGroupByOutputType[P]>
            : GetScalarType<T[P], TradeLogGroupByOutputType[P]>
        }
      >
    >


  export type TradeLogSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    pair?: boolean
    timeframe?: boolean
    session?: boolean
    action?: boolean
    pnl?: boolean
    notes?: boolean
    leverage?: boolean
    entry?: boolean
    stop?: boolean
    tp1?: boolean
    tp2?: boolean
    rr1?: boolean
    rr2?: boolean
    directionBias?: boolean
    eventType?: boolean
    sweepType?: boolean
    emaContext?: boolean
    reclaimConfirmed?: boolean
    planFollowed?: boolean
    ruleBreak?: boolean
    executionType?: boolean
    liquidityLevel?: boolean
    htfBias?: boolean
    entryTrigger?: boolean
    outcome?: boolean
    confidenceSelf?: boolean
    durationMinutes?: boolean
    emotionalPressure?: boolean
    setupQuality?: boolean
    disciplineScore?: boolean
    linkedEventId?: boolean
    screenshotUrl?: boolean
    aiScore?: boolean
    aiGrade?: boolean
    aiSummary?: boolean
    aiCoachingNote?: boolean
    aiStatus?: boolean
    setupScore?: boolean
    executionScore?: boolean
    managementScore?: boolean
    disciplineScoreAi?: boolean
    aiConfidence?: boolean
    chartRead?: boolean
    setupAssessment?: boolean
    executionAssessment?: boolean
    riskAssessment?: boolean
    biasAlignment?: boolean
    mistakeTags?: boolean
    whatWasGood?: boolean
    whatNeedsWork?: boolean
    usedScreenshot?: boolean
    aiPayload?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["tradeLog"]>

  export type TradeLogSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    pair?: boolean
    timeframe?: boolean
    session?: boolean
    action?: boolean
    pnl?: boolean
    notes?: boolean
    leverage?: boolean
    entry?: boolean
    stop?: boolean
    tp1?: boolean
    tp2?: boolean
    rr1?: boolean
    rr2?: boolean
    directionBias?: boolean
    eventType?: boolean
    sweepType?: boolean
    emaContext?: boolean
    reclaimConfirmed?: boolean
    planFollowed?: boolean
    ruleBreak?: boolean
    executionType?: boolean
    liquidityLevel?: boolean
    htfBias?: boolean
    entryTrigger?: boolean
    outcome?: boolean
    confidenceSelf?: boolean
    durationMinutes?: boolean
    emotionalPressure?: boolean
    setupQuality?: boolean
    disciplineScore?: boolean
    linkedEventId?: boolean
    screenshotUrl?: boolean
    aiScore?: boolean
    aiGrade?: boolean
    aiSummary?: boolean
    aiCoachingNote?: boolean
    aiStatus?: boolean
    setupScore?: boolean
    executionScore?: boolean
    managementScore?: boolean
    disciplineScoreAi?: boolean
    aiConfidence?: boolean
    chartRead?: boolean
    setupAssessment?: boolean
    executionAssessment?: boolean
    riskAssessment?: boolean
    biasAlignment?: boolean
    mistakeTags?: boolean
    whatWasGood?: boolean
    whatNeedsWork?: boolean
    usedScreenshot?: boolean
    aiPayload?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["tradeLog"]>

  export type TradeLogSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    pair?: boolean
    timeframe?: boolean
    session?: boolean
    action?: boolean
    pnl?: boolean
    notes?: boolean
    leverage?: boolean
    entry?: boolean
    stop?: boolean
    tp1?: boolean
    tp2?: boolean
    rr1?: boolean
    rr2?: boolean
    directionBias?: boolean
    eventType?: boolean
    sweepType?: boolean
    emaContext?: boolean
    reclaimConfirmed?: boolean
    planFollowed?: boolean
    ruleBreak?: boolean
    executionType?: boolean
    liquidityLevel?: boolean
    htfBias?: boolean
    entryTrigger?: boolean
    outcome?: boolean
    confidenceSelf?: boolean
    durationMinutes?: boolean
    emotionalPressure?: boolean
    setupQuality?: boolean
    disciplineScore?: boolean
    linkedEventId?: boolean
    screenshotUrl?: boolean
    aiScore?: boolean
    aiGrade?: boolean
    aiSummary?: boolean
    aiCoachingNote?: boolean
    aiStatus?: boolean
    setupScore?: boolean
    executionScore?: boolean
    managementScore?: boolean
    disciplineScoreAi?: boolean
    aiConfidence?: boolean
    chartRead?: boolean
    setupAssessment?: boolean
    executionAssessment?: boolean
    riskAssessment?: boolean
    biasAlignment?: boolean
    mistakeTags?: boolean
    whatWasGood?: boolean
    whatNeedsWork?: boolean
    usedScreenshot?: boolean
    aiPayload?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["tradeLog"]>

  export type TradeLogSelectScalar = {
    id?: boolean
    userId?: boolean
    pair?: boolean
    timeframe?: boolean
    session?: boolean
    action?: boolean
    pnl?: boolean
    notes?: boolean
    leverage?: boolean
    entry?: boolean
    stop?: boolean
    tp1?: boolean
    tp2?: boolean
    rr1?: boolean
    rr2?: boolean
    directionBias?: boolean
    eventType?: boolean
    sweepType?: boolean
    emaContext?: boolean
    reclaimConfirmed?: boolean
    planFollowed?: boolean
    ruleBreak?: boolean
    executionType?: boolean
    liquidityLevel?: boolean
    htfBias?: boolean
    entryTrigger?: boolean
    outcome?: boolean
    confidenceSelf?: boolean
    durationMinutes?: boolean
    emotionalPressure?: boolean
    setupQuality?: boolean
    disciplineScore?: boolean
    linkedEventId?: boolean
    screenshotUrl?: boolean
    aiScore?: boolean
    aiGrade?: boolean
    aiSummary?: boolean
    aiCoachingNote?: boolean
    aiStatus?: boolean
    setupScore?: boolean
    executionScore?: boolean
    managementScore?: boolean
    disciplineScoreAi?: boolean
    aiConfidence?: boolean
    chartRead?: boolean
    setupAssessment?: boolean
    executionAssessment?: boolean
    riskAssessment?: boolean
    biasAlignment?: boolean
    mistakeTags?: boolean
    whatWasGood?: boolean
    whatNeedsWork?: boolean
    usedScreenshot?: boolean
    aiPayload?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type TradeLogOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "userId" | "pair" | "timeframe" | "session" | "action" | "pnl" | "notes" | "leverage" | "entry" | "stop" | "tp1" | "tp2" | "rr1" | "rr2" | "directionBias" | "eventType" | "sweepType" | "emaContext" | "reclaimConfirmed" | "planFollowed" | "ruleBreak" | "executionType" | "liquidityLevel" | "htfBias" | "entryTrigger" | "outcome" | "confidenceSelf" | "durationMinutes" | "emotionalPressure" | "setupQuality" | "disciplineScore" | "linkedEventId" | "screenshotUrl" | "aiScore" | "aiGrade" | "aiSummary" | "aiCoachingNote" | "aiStatus" | "setupScore" | "executionScore" | "managementScore" | "disciplineScoreAi" | "aiConfidence" | "chartRead" | "setupAssessment" | "executionAssessment" | "riskAssessment" | "biasAlignment" | "mistakeTags" | "whatWasGood" | "whatNeedsWork" | "usedScreenshot" | "aiPayload" | "createdAt" | "updatedAt", ExtArgs["result"]["tradeLog"]>
  export type TradeLogInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }
  export type TradeLogIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }
  export type TradeLogIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }

  export type $TradeLogPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "TradeLog"
    objects: {
      user: Prisma.$UserPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      userId: string
      pair: string | null
      timeframe: string | null
      session: string | null
      action: string | null
      pnl: number | null
      notes: string | null
      leverage: number | null
      entry: number | null
      stop: number | null
      tp1: number | null
      tp2: number | null
      rr1: number | null
      rr2: number | null
      directionBias: string | null
      eventType: string | null
      sweepType: string | null
      emaContext: string | null
      reclaimConfirmed: boolean | null
      planFollowed: string | null
      ruleBreak: string | null
      executionType: string | null
      liquidityLevel: string | null
      htfBias: string | null
      entryTrigger: string | null
      outcome: string | null
      confidenceSelf: number | null
      durationMinutes: number | null
      emotionalPressure: number | null
      setupQuality: number | null
      disciplineScore: number | null
      linkedEventId: string | null
      screenshotUrl: string | null
      aiScore: number | null
      aiGrade: string | null
      aiSummary: string | null
      aiCoachingNote: string | null
      aiStatus: string | null
      setupScore: number | null
      executionScore: number | null
      managementScore: number | null
      disciplineScoreAi: number | null
      aiConfidence: number | null
      chartRead: string | null
      setupAssessment: string | null
      executionAssessment: string | null
      riskAssessment: string | null
      biasAlignment: string | null
      mistakeTags: Prisma.JsonValue | null
      whatWasGood: Prisma.JsonValue | null
      whatNeedsWork: Prisma.JsonValue | null
      usedScreenshot: boolean | null
      aiPayload: Prisma.JsonValue | null
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["tradeLog"]>
    composites: {}
  }

  type TradeLogGetPayload<S extends boolean | null | undefined | TradeLogDefaultArgs> = $Result.GetResult<Prisma.$TradeLogPayload, S>

  type TradeLogCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<TradeLogFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: TradeLogCountAggregateInputType | true
    }

  export interface TradeLogDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['TradeLog'], meta: { name: 'TradeLog' } }
    /**
     * Find zero or one TradeLog that matches the filter.
     * @param {TradeLogFindUniqueArgs} args - Arguments to find a TradeLog
     * @example
     * // Get one TradeLog
     * const tradeLog = await prisma.tradeLog.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends TradeLogFindUniqueArgs>(args: SelectSubset<T, TradeLogFindUniqueArgs<ExtArgs>>): Prisma__TradeLogClient<$Result.GetResult<Prisma.$TradeLogPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one TradeLog that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {TradeLogFindUniqueOrThrowArgs} args - Arguments to find a TradeLog
     * @example
     * // Get one TradeLog
     * const tradeLog = await prisma.tradeLog.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends TradeLogFindUniqueOrThrowArgs>(args: SelectSubset<T, TradeLogFindUniqueOrThrowArgs<ExtArgs>>): Prisma__TradeLogClient<$Result.GetResult<Prisma.$TradeLogPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first TradeLog that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TradeLogFindFirstArgs} args - Arguments to find a TradeLog
     * @example
     * // Get one TradeLog
     * const tradeLog = await prisma.tradeLog.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends TradeLogFindFirstArgs>(args?: SelectSubset<T, TradeLogFindFirstArgs<ExtArgs>>): Prisma__TradeLogClient<$Result.GetResult<Prisma.$TradeLogPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first TradeLog that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TradeLogFindFirstOrThrowArgs} args - Arguments to find a TradeLog
     * @example
     * // Get one TradeLog
     * const tradeLog = await prisma.tradeLog.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends TradeLogFindFirstOrThrowArgs>(args?: SelectSubset<T, TradeLogFindFirstOrThrowArgs<ExtArgs>>): Prisma__TradeLogClient<$Result.GetResult<Prisma.$TradeLogPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more TradeLogs that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TradeLogFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all TradeLogs
     * const tradeLogs = await prisma.tradeLog.findMany()
     * 
     * // Get first 10 TradeLogs
     * const tradeLogs = await prisma.tradeLog.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const tradeLogWithIdOnly = await prisma.tradeLog.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends TradeLogFindManyArgs>(args?: SelectSubset<T, TradeLogFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TradeLogPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a TradeLog.
     * @param {TradeLogCreateArgs} args - Arguments to create a TradeLog.
     * @example
     * // Create one TradeLog
     * const TradeLog = await prisma.tradeLog.create({
     *   data: {
     *     // ... data to create a TradeLog
     *   }
     * })
     * 
     */
    create<T extends TradeLogCreateArgs>(args: SelectSubset<T, TradeLogCreateArgs<ExtArgs>>): Prisma__TradeLogClient<$Result.GetResult<Prisma.$TradeLogPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many TradeLogs.
     * @param {TradeLogCreateManyArgs} args - Arguments to create many TradeLogs.
     * @example
     * // Create many TradeLogs
     * const tradeLog = await prisma.tradeLog.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends TradeLogCreateManyArgs>(args?: SelectSubset<T, TradeLogCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many TradeLogs and returns the data saved in the database.
     * @param {TradeLogCreateManyAndReturnArgs} args - Arguments to create many TradeLogs.
     * @example
     * // Create many TradeLogs
     * const tradeLog = await prisma.tradeLog.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many TradeLogs and only return the `id`
     * const tradeLogWithIdOnly = await prisma.tradeLog.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends TradeLogCreateManyAndReturnArgs>(args?: SelectSubset<T, TradeLogCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TradeLogPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a TradeLog.
     * @param {TradeLogDeleteArgs} args - Arguments to delete one TradeLog.
     * @example
     * // Delete one TradeLog
     * const TradeLog = await prisma.tradeLog.delete({
     *   where: {
     *     // ... filter to delete one TradeLog
     *   }
     * })
     * 
     */
    delete<T extends TradeLogDeleteArgs>(args: SelectSubset<T, TradeLogDeleteArgs<ExtArgs>>): Prisma__TradeLogClient<$Result.GetResult<Prisma.$TradeLogPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one TradeLog.
     * @param {TradeLogUpdateArgs} args - Arguments to update one TradeLog.
     * @example
     * // Update one TradeLog
     * const tradeLog = await prisma.tradeLog.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends TradeLogUpdateArgs>(args: SelectSubset<T, TradeLogUpdateArgs<ExtArgs>>): Prisma__TradeLogClient<$Result.GetResult<Prisma.$TradeLogPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more TradeLogs.
     * @param {TradeLogDeleteManyArgs} args - Arguments to filter TradeLogs to delete.
     * @example
     * // Delete a few TradeLogs
     * const { count } = await prisma.tradeLog.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends TradeLogDeleteManyArgs>(args?: SelectSubset<T, TradeLogDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more TradeLogs.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TradeLogUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many TradeLogs
     * const tradeLog = await prisma.tradeLog.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends TradeLogUpdateManyArgs>(args: SelectSubset<T, TradeLogUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more TradeLogs and returns the data updated in the database.
     * @param {TradeLogUpdateManyAndReturnArgs} args - Arguments to update many TradeLogs.
     * @example
     * // Update many TradeLogs
     * const tradeLog = await prisma.tradeLog.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more TradeLogs and only return the `id`
     * const tradeLogWithIdOnly = await prisma.tradeLog.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends TradeLogUpdateManyAndReturnArgs>(args: SelectSubset<T, TradeLogUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TradeLogPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one TradeLog.
     * @param {TradeLogUpsertArgs} args - Arguments to update or create a TradeLog.
     * @example
     * // Update or create a TradeLog
     * const tradeLog = await prisma.tradeLog.upsert({
     *   create: {
     *     // ... data to create a TradeLog
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the TradeLog we want to update
     *   }
     * })
     */
    upsert<T extends TradeLogUpsertArgs>(args: SelectSubset<T, TradeLogUpsertArgs<ExtArgs>>): Prisma__TradeLogClient<$Result.GetResult<Prisma.$TradeLogPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of TradeLogs.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TradeLogCountArgs} args - Arguments to filter TradeLogs to count.
     * @example
     * // Count the number of TradeLogs
     * const count = await prisma.tradeLog.count({
     *   where: {
     *     // ... the filter for the TradeLogs we want to count
     *   }
     * })
    **/
    count<T extends TradeLogCountArgs>(
      args?: Subset<T, TradeLogCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], TradeLogCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a TradeLog.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TradeLogAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends TradeLogAggregateArgs>(args: Subset<T, TradeLogAggregateArgs>): Prisma.PrismaPromise<GetTradeLogAggregateType<T>>

    /**
     * Group by TradeLog.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TradeLogGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends TradeLogGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: TradeLogGroupByArgs['orderBy'] }
        : { orderBy?: TradeLogGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, TradeLogGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetTradeLogGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the TradeLog model
   */
  readonly fields: TradeLogFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for TradeLog.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__TradeLogClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    user<T extends UserDefaultArgs<ExtArgs> = {}>(args?: Subset<T, UserDefaultArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the TradeLog model
   */
  interface TradeLogFieldRefs {
    readonly id: FieldRef<"TradeLog", 'String'>
    readonly userId: FieldRef<"TradeLog", 'String'>
    readonly pair: FieldRef<"TradeLog", 'String'>
    readonly timeframe: FieldRef<"TradeLog", 'String'>
    readonly session: FieldRef<"TradeLog", 'String'>
    readonly action: FieldRef<"TradeLog", 'String'>
    readonly pnl: FieldRef<"TradeLog", 'Float'>
    readonly notes: FieldRef<"TradeLog", 'String'>
    readonly leverage: FieldRef<"TradeLog", 'Float'>
    readonly entry: FieldRef<"TradeLog", 'Float'>
    readonly stop: FieldRef<"TradeLog", 'Float'>
    readonly tp1: FieldRef<"TradeLog", 'Float'>
    readonly tp2: FieldRef<"TradeLog", 'Float'>
    readonly rr1: FieldRef<"TradeLog", 'Float'>
    readonly rr2: FieldRef<"TradeLog", 'Float'>
    readonly directionBias: FieldRef<"TradeLog", 'String'>
    readonly eventType: FieldRef<"TradeLog", 'String'>
    readonly sweepType: FieldRef<"TradeLog", 'String'>
    readonly emaContext: FieldRef<"TradeLog", 'String'>
    readonly reclaimConfirmed: FieldRef<"TradeLog", 'Boolean'>
    readonly planFollowed: FieldRef<"TradeLog", 'String'>
    readonly ruleBreak: FieldRef<"TradeLog", 'String'>
    readonly executionType: FieldRef<"TradeLog", 'String'>
    readonly liquidityLevel: FieldRef<"TradeLog", 'String'>
    readonly htfBias: FieldRef<"TradeLog", 'String'>
    readonly entryTrigger: FieldRef<"TradeLog", 'String'>
    readonly outcome: FieldRef<"TradeLog", 'String'>
    readonly confidenceSelf: FieldRef<"TradeLog", 'Float'>
    readonly durationMinutes: FieldRef<"TradeLog", 'Float'>
    readonly emotionalPressure: FieldRef<"TradeLog", 'Float'>
    readonly setupQuality: FieldRef<"TradeLog", 'Float'>
    readonly disciplineScore: FieldRef<"TradeLog", 'Float'>
    readonly linkedEventId: FieldRef<"TradeLog", 'String'>
    readonly screenshotUrl: FieldRef<"TradeLog", 'String'>
    readonly aiScore: FieldRef<"TradeLog", 'Int'>
    readonly aiGrade: FieldRef<"TradeLog", 'String'>
    readonly aiSummary: FieldRef<"TradeLog", 'String'>
    readonly aiCoachingNote: FieldRef<"TradeLog", 'String'>
    readonly aiStatus: FieldRef<"TradeLog", 'String'>
    readonly setupScore: FieldRef<"TradeLog", 'Int'>
    readonly executionScore: FieldRef<"TradeLog", 'Int'>
    readonly managementScore: FieldRef<"TradeLog", 'Int'>
    readonly disciplineScoreAi: FieldRef<"TradeLog", 'Int'>
    readonly aiConfidence: FieldRef<"TradeLog", 'Float'>
    readonly chartRead: FieldRef<"TradeLog", 'String'>
    readonly setupAssessment: FieldRef<"TradeLog", 'String'>
    readonly executionAssessment: FieldRef<"TradeLog", 'String'>
    readonly riskAssessment: FieldRef<"TradeLog", 'String'>
    readonly biasAlignment: FieldRef<"TradeLog", 'String'>
    readonly mistakeTags: FieldRef<"TradeLog", 'Json'>
    readonly whatWasGood: FieldRef<"TradeLog", 'Json'>
    readonly whatNeedsWork: FieldRef<"TradeLog", 'Json'>
    readonly usedScreenshot: FieldRef<"TradeLog", 'Boolean'>
    readonly aiPayload: FieldRef<"TradeLog", 'Json'>
    readonly createdAt: FieldRef<"TradeLog", 'DateTime'>
    readonly updatedAt: FieldRef<"TradeLog", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * TradeLog findUnique
   */
  export type TradeLogFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TradeLog
     */
    select?: TradeLogSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TradeLog
     */
    omit?: TradeLogOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TradeLogInclude<ExtArgs> | null
    /**
     * Filter, which TradeLog to fetch.
     */
    where: TradeLogWhereUniqueInput
  }

  /**
   * TradeLog findUniqueOrThrow
   */
  export type TradeLogFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TradeLog
     */
    select?: TradeLogSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TradeLog
     */
    omit?: TradeLogOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TradeLogInclude<ExtArgs> | null
    /**
     * Filter, which TradeLog to fetch.
     */
    where: TradeLogWhereUniqueInput
  }

  /**
   * TradeLog findFirst
   */
  export type TradeLogFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TradeLog
     */
    select?: TradeLogSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TradeLog
     */
    omit?: TradeLogOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TradeLogInclude<ExtArgs> | null
    /**
     * Filter, which TradeLog to fetch.
     */
    where?: TradeLogWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of TradeLogs to fetch.
     */
    orderBy?: TradeLogOrderByWithRelationInput | TradeLogOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for TradeLogs.
     */
    cursor?: TradeLogWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` TradeLogs from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` TradeLogs.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of TradeLogs.
     */
    distinct?: TradeLogScalarFieldEnum | TradeLogScalarFieldEnum[]
  }

  /**
   * TradeLog findFirstOrThrow
   */
  export type TradeLogFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TradeLog
     */
    select?: TradeLogSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TradeLog
     */
    omit?: TradeLogOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TradeLogInclude<ExtArgs> | null
    /**
     * Filter, which TradeLog to fetch.
     */
    where?: TradeLogWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of TradeLogs to fetch.
     */
    orderBy?: TradeLogOrderByWithRelationInput | TradeLogOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for TradeLogs.
     */
    cursor?: TradeLogWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` TradeLogs from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` TradeLogs.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of TradeLogs.
     */
    distinct?: TradeLogScalarFieldEnum | TradeLogScalarFieldEnum[]
  }

  /**
   * TradeLog findMany
   */
  export type TradeLogFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TradeLog
     */
    select?: TradeLogSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TradeLog
     */
    omit?: TradeLogOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TradeLogInclude<ExtArgs> | null
    /**
     * Filter, which TradeLogs to fetch.
     */
    where?: TradeLogWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of TradeLogs to fetch.
     */
    orderBy?: TradeLogOrderByWithRelationInput | TradeLogOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing TradeLogs.
     */
    cursor?: TradeLogWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` TradeLogs from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` TradeLogs.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of TradeLogs.
     */
    distinct?: TradeLogScalarFieldEnum | TradeLogScalarFieldEnum[]
  }

  /**
   * TradeLog create
   */
  export type TradeLogCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TradeLog
     */
    select?: TradeLogSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TradeLog
     */
    omit?: TradeLogOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TradeLogInclude<ExtArgs> | null
    /**
     * The data needed to create a TradeLog.
     */
    data: XOR<TradeLogCreateInput, TradeLogUncheckedCreateInput>
  }

  /**
   * TradeLog createMany
   */
  export type TradeLogCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many TradeLogs.
     */
    data: TradeLogCreateManyInput | TradeLogCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * TradeLog createManyAndReturn
   */
  export type TradeLogCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TradeLog
     */
    select?: TradeLogSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the TradeLog
     */
    omit?: TradeLogOmit<ExtArgs> | null
    /**
     * The data used to create many TradeLogs.
     */
    data: TradeLogCreateManyInput | TradeLogCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TradeLogIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * TradeLog update
   */
  export type TradeLogUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TradeLog
     */
    select?: TradeLogSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TradeLog
     */
    omit?: TradeLogOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TradeLogInclude<ExtArgs> | null
    /**
     * The data needed to update a TradeLog.
     */
    data: XOR<TradeLogUpdateInput, TradeLogUncheckedUpdateInput>
    /**
     * Choose, which TradeLog to update.
     */
    where: TradeLogWhereUniqueInput
  }

  /**
   * TradeLog updateMany
   */
  export type TradeLogUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update TradeLogs.
     */
    data: XOR<TradeLogUpdateManyMutationInput, TradeLogUncheckedUpdateManyInput>
    /**
     * Filter which TradeLogs to update
     */
    where?: TradeLogWhereInput
    /**
     * Limit how many TradeLogs to update.
     */
    limit?: number
  }

  /**
   * TradeLog updateManyAndReturn
   */
  export type TradeLogUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TradeLog
     */
    select?: TradeLogSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the TradeLog
     */
    omit?: TradeLogOmit<ExtArgs> | null
    /**
     * The data used to update TradeLogs.
     */
    data: XOR<TradeLogUpdateManyMutationInput, TradeLogUncheckedUpdateManyInput>
    /**
     * Filter which TradeLogs to update
     */
    where?: TradeLogWhereInput
    /**
     * Limit how many TradeLogs to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TradeLogIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * TradeLog upsert
   */
  export type TradeLogUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TradeLog
     */
    select?: TradeLogSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TradeLog
     */
    omit?: TradeLogOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TradeLogInclude<ExtArgs> | null
    /**
     * The filter to search for the TradeLog to update in case it exists.
     */
    where: TradeLogWhereUniqueInput
    /**
     * In case the TradeLog found by the `where` argument doesn't exist, create a new TradeLog with this data.
     */
    create: XOR<TradeLogCreateInput, TradeLogUncheckedCreateInput>
    /**
     * In case the TradeLog was found with the provided `where` argument, update it with this data.
     */
    update: XOR<TradeLogUpdateInput, TradeLogUncheckedUpdateInput>
  }

  /**
   * TradeLog delete
   */
  export type TradeLogDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TradeLog
     */
    select?: TradeLogSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TradeLog
     */
    omit?: TradeLogOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TradeLogInclude<ExtArgs> | null
    /**
     * Filter which TradeLog to delete.
     */
    where: TradeLogWhereUniqueInput
  }

  /**
   * TradeLog deleteMany
   */
  export type TradeLogDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which TradeLogs to delete
     */
    where?: TradeLogWhereInput
    /**
     * Limit how many TradeLogs to delete.
     */
    limit?: number
  }

  /**
   * TradeLog without action
   */
  export type TradeLogDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TradeLog
     */
    select?: TradeLogSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TradeLog
     */
    omit?: TradeLogOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TradeLogInclude<ExtArgs> | null
  }


  /**
   * Enums
   */

  export const TransactionIsolationLevel: {
    ReadUncommitted: 'ReadUncommitted',
    ReadCommitted: 'ReadCommitted',
    RepeatableRead: 'RepeatableRead',
    Serializable: 'Serializable'
  };

  export type TransactionIsolationLevel = (typeof TransactionIsolationLevel)[keyof typeof TransactionIsolationLevel]


  export const UserScalarFieldEnum: {
    id: 'id',
    email: 'email',
    passwordHash: 'passwordHash',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    stripeCustomerId: 'stripeCustomerId',
    stripeSubId: 'stripeSubId',
    stripePriceId: 'stripePriceId',
    billingStatus: 'billingStatus',
    billingPlan: 'billingPlan',
    billingPeriodEnd: 'billingPeriodEnd',
    isActive: 'isActive'
  };

  export type UserScalarFieldEnum = (typeof UserScalarFieldEnum)[keyof typeof UserScalarFieldEnum]


  export const TradeLogScalarFieldEnum: {
    id: 'id',
    userId: 'userId',
    pair: 'pair',
    timeframe: 'timeframe',
    session: 'session',
    action: 'action',
    pnl: 'pnl',
    notes: 'notes',
    leverage: 'leverage',
    entry: 'entry',
    stop: 'stop',
    tp1: 'tp1',
    tp2: 'tp2',
    rr1: 'rr1',
    rr2: 'rr2',
    directionBias: 'directionBias',
    eventType: 'eventType',
    sweepType: 'sweepType',
    emaContext: 'emaContext',
    reclaimConfirmed: 'reclaimConfirmed',
    planFollowed: 'planFollowed',
    ruleBreak: 'ruleBreak',
    executionType: 'executionType',
    liquidityLevel: 'liquidityLevel',
    htfBias: 'htfBias',
    entryTrigger: 'entryTrigger',
    outcome: 'outcome',
    confidenceSelf: 'confidenceSelf',
    durationMinutes: 'durationMinutes',
    emotionalPressure: 'emotionalPressure',
    setupQuality: 'setupQuality',
    disciplineScore: 'disciplineScore',
    linkedEventId: 'linkedEventId',
    screenshotUrl: 'screenshotUrl',
    aiScore: 'aiScore',
    aiGrade: 'aiGrade',
    aiSummary: 'aiSummary',
    aiCoachingNote: 'aiCoachingNote',
    aiStatus: 'aiStatus',
    setupScore: 'setupScore',
    executionScore: 'executionScore',
    managementScore: 'managementScore',
    disciplineScoreAi: 'disciplineScoreAi',
    aiConfidence: 'aiConfidence',
    chartRead: 'chartRead',
    setupAssessment: 'setupAssessment',
    executionAssessment: 'executionAssessment',
    riskAssessment: 'riskAssessment',
    biasAlignment: 'biasAlignment',
    mistakeTags: 'mistakeTags',
    whatWasGood: 'whatWasGood',
    whatNeedsWork: 'whatNeedsWork',
    usedScreenshot: 'usedScreenshot',
    aiPayload: 'aiPayload',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type TradeLogScalarFieldEnum = (typeof TradeLogScalarFieldEnum)[keyof typeof TradeLogScalarFieldEnum]


  export const SortOrder: {
    asc: 'asc',
    desc: 'desc'
  };

  export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder]


  export const NullableJsonNullValueInput: {
    DbNull: typeof DbNull,
    JsonNull: typeof JsonNull
  };

  export type NullableJsonNullValueInput = (typeof NullableJsonNullValueInput)[keyof typeof NullableJsonNullValueInput]


  export const QueryMode: {
    default: 'default',
    insensitive: 'insensitive'
  };

  export type QueryMode = (typeof QueryMode)[keyof typeof QueryMode]


  export const NullsOrder: {
    first: 'first',
    last: 'last'
  };

  export type NullsOrder = (typeof NullsOrder)[keyof typeof NullsOrder]


  export const JsonNullValueFilter: {
    DbNull: typeof DbNull,
    JsonNull: typeof JsonNull,
    AnyNull: typeof AnyNull
  };

  export type JsonNullValueFilter = (typeof JsonNullValueFilter)[keyof typeof JsonNullValueFilter]


  /**
   * Field references
   */


  /**
   * Reference to a field of type 'String'
   */
  export type StringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String'>
    


  /**
   * Reference to a field of type 'String[]'
   */
  export type ListStringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String[]'>
    


  /**
   * Reference to a field of type 'DateTime'
   */
  export type DateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime'>
    


  /**
   * Reference to a field of type 'DateTime[]'
   */
  export type ListDateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime[]'>
    


  /**
   * Reference to a field of type 'Boolean'
   */
  export type BooleanFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Boolean'>
    


  /**
   * Reference to a field of type 'Float'
   */
  export type FloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Float'>
    


  /**
   * Reference to a field of type 'Float[]'
   */
  export type ListFloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Float[]'>
    


  /**
   * Reference to a field of type 'Int'
   */
  export type IntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int'>
    


  /**
   * Reference to a field of type 'Int[]'
   */
  export type ListIntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int[]'>
    


  /**
   * Reference to a field of type 'Json'
   */
  export type JsonFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Json'>
    


  /**
   * Reference to a field of type 'QueryMode'
   */
  export type EnumQueryModeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'QueryMode'>
    
  /**
   * Deep Input Types
   */


  export type UserWhereInput = {
    AND?: UserWhereInput | UserWhereInput[]
    OR?: UserWhereInput[]
    NOT?: UserWhereInput | UserWhereInput[]
    id?: StringFilter<"User"> | string
    email?: StringFilter<"User"> | string
    passwordHash?: StringFilter<"User"> | string
    createdAt?: DateTimeFilter<"User"> | Date | string
    updatedAt?: DateTimeFilter<"User"> | Date | string
    stripeCustomerId?: StringNullableFilter<"User"> | string | null
    stripeSubId?: StringNullableFilter<"User"> | string | null
    stripePriceId?: StringNullableFilter<"User"> | string | null
    billingStatus?: StringNullableFilter<"User"> | string | null
    billingPlan?: StringNullableFilter<"User"> | string | null
    billingPeriodEnd?: DateTimeNullableFilter<"User"> | Date | string | null
    isActive?: BoolFilter<"User"> | boolean
    logs?: TradeLogListRelationFilter
  }

  export type UserOrderByWithRelationInput = {
    id?: SortOrder
    email?: SortOrder
    passwordHash?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    stripeCustomerId?: SortOrderInput | SortOrder
    stripeSubId?: SortOrderInput | SortOrder
    stripePriceId?: SortOrderInput | SortOrder
    billingStatus?: SortOrderInput | SortOrder
    billingPlan?: SortOrderInput | SortOrder
    billingPeriodEnd?: SortOrderInput | SortOrder
    isActive?: SortOrder
    logs?: TradeLogOrderByRelationAggregateInput
  }

  export type UserWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    email?: string
    stripeCustomerId?: string
    stripeSubId?: string
    AND?: UserWhereInput | UserWhereInput[]
    OR?: UserWhereInput[]
    NOT?: UserWhereInput | UserWhereInput[]
    passwordHash?: StringFilter<"User"> | string
    createdAt?: DateTimeFilter<"User"> | Date | string
    updatedAt?: DateTimeFilter<"User"> | Date | string
    stripePriceId?: StringNullableFilter<"User"> | string | null
    billingStatus?: StringNullableFilter<"User"> | string | null
    billingPlan?: StringNullableFilter<"User"> | string | null
    billingPeriodEnd?: DateTimeNullableFilter<"User"> | Date | string | null
    isActive?: BoolFilter<"User"> | boolean
    logs?: TradeLogListRelationFilter
  }, "id" | "email" | "stripeCustomerId" | "stripeSubId">

  export type UserOrderByWithAggregationInput = {
    id?: SortOrder
    email?: SortOrder
    passwordHash?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    stripeCustomerId?: SortOrderInput | SortOrder
    stripeSubId?: SortOrderInput | SortOrder
    stripePriceId?: SortOrderInput | SortOrder
    billingStatus?: SortOrderInput | SortOrder
    billingPlan?: SortOrderInput | SortOrder
    billingPeriodEnd?: SortOrderInput | SortOrder
    isActive?: SortOrder
    _count?: UserCountOrderByAggregateInput
    _max?: UserMaxOrderByAggregateInput
    _min?: UserMinOrderByAggregateInput
  }

  export type UserScalarWhereWithAggregatesInput = {
    AND?: UserScalarWhereWithAggregatesInput | UserScalarWhereWithAggregatesInput[]
    OR?: UserScalarWhereWithAggregatesInput[]
    NOT?: UserScalarWhereWithAggregatesInput | UserScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"User"> | string
    email?: StringWithAggregatesFilter<"User"> | string
    passwordHash?: StringWithAggregatesFilter<"User"> | string
    createdAt?: DateTimeWithAggregatesFilter<"User"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"User"> | Date | string
    stripeCustomerId?: StringNullableWithAggregatesFilter<"User"> | string | null
    stripeSubId?: StringNullableWithAggregatesFilter<"User"> | string | null
    stripePriceId?: StringNullableWithAggregatesFilter<"User"> | string | null
    billingStatus?: StringNullableWithAggregatesFilter<"User"> | string | null
    billingPlan?: StringNullableWithAggregatesFilter<"User"> | string | null
    billingPeriodEnd?: DateTimeNullableWithAggregatesFilter<"User"> | Date | string | null
    isActive?: BoolWithAggregatesFilter<"User"> | boolean
  }

  export type TradeLogWhereInput = {
    AND?: TradeLogWhereInput | TradeLogWhereInput[]
    OR?: TradeLogWhereInput[]
    NOT?: TradeLogWhereInput | TradeLogWhereInput[]
    id?: StringFilter<"TradeLog"> | string
    userId?: StringFilter<"TradeLog"> | string
    pair?: StringNullableFilter<"TradeLog"> | string | null
    timeframe?: StringNullableFilter<"TradeLog"> | string | null
    session?: StringNullableFilter<"TradeLog"> | string | null
    action?: StringNullableFilter<"TradeLog"> | string | null
    pnl?: FloatNullableFilter<"TradeLog"> | number | null
    notes?: StringNullableFilter<"TradeLog"> | string | null
    leverage?: FloatNullableFilter<"TradeLog"> | number | null
    entry?: FloatNullableFilter<"TradeLog"> | number | null
    stop?: FloatNullableFilter<"TradeLog"> | number | null
    tp1?: FloatNullableFilter<"TradeLog"> | number | null
    tp2?: FloatNullableFilter<"TradeLog"> | number | null
    rr1?: FloatNullableFilter<"TradeLog"> | number | null
    rr2?: FloatNullableFilter<"TradeLog"> | number | null
    directionBias?: StringNullableFilter<"TradeLog"> | string | null
    eventType?: StringNullableFilter<"TradeLog"> | string | null
    sweepType?: StringNullableFilter<"TradeLog"> | string | null
    emaContext?: StringNullableFilter<"TradeLog"> | string | null
    reclaimConfirmed?: BoolNullableFilter<"TradeLog"> | boolean | null
    planFollowed?: StringNullableFilter<"TradeLog"> | string | null
    ruleBreak?: StringNullableFilter<"TradeLog"> | string | null
    executionType?: StringNullableFilter<"TradeLog"> | string | null
    liquidityLevel?: StringNullableFilter<"TradeLog"> | string | null
    htfBias?: StringNullableFilter<"TradeLog"> | string | null
    entryTrigger?: StringNullableFilter<"TradeLog"> | string | null
    outcome?: StringNullableFilter<"TradeLog"> | string | null
    confidenceSelf?: FloatNullableFilter<"TradeLog"> | number | null
    durationMinutes?: FloatNullableFilter<"TradeLog"> | number | null
    emotionalPressure?: FloatNullableFilter<"TradeLog"> | number | null
    setupQuality?: FloatNullableFilter<"TradeLog"> | number | null
    disciplineScore?: FloatNullableFilter<"TradeLog"> | number | null
    linkedEventId?: StringNullableFilter<"TradeLog"> | string | null
    screenshotUrl?: StringNullableFilter<"TradeLog"> | string | null
    aiScore?: IntNullableFilter<"TradeLog"> | number | null
    aiGrade?: StringNullableFilter<"TradeLog"> | string | null
    aiSummary?: StringNullableFilter<"TradeLog"> | string | null
    aiCoachingNote?: StringNullableFilter<"TradeLog"> | string | null
    aiStatus?: StringNullableFilter<"TradeLog"> | string | null
    setupScore?: IntNullableFilter<"TradeLog"> | number | null
    executionScore?: IntNullableFilter<"TradeLog"> | number | null
    managementScore?: IntNullableFilter<"TradeLog"> | number | null
    disciplineScoreAi?: IntNullableFilter<"TradeLog"> | number | null
    aiConfidence?: FloatNullableFilter<"TradeLog"> | number | null
    chartRead?: StringNullableFilter<"TradeLog"> | string | null
    setupAssessment?: StringNullableFilter<"TradeLog"> | string | null
    executionAssessment?: StringNullableFilter<"TradeLog"> | string | null
    riskAssessment?: StringNullableFilter<"TradeLog"> | string | null
    biasAlignment?: StringNullableFilter<"TradeLog"> | string | null
    mistakeTags?: JsonNullableFilter<"TradeLog">
    whatWasGood?: JsonNullableFilter<"TradeLog">
    whatNeedsWork?: JsonNullableFilter<"TradeLog">
    usedScreenshot?: BoolNullableFilter<"TradeLog"> | boolean | null
    aiPayload?: JsonNullableFilter<"TradeLog">
    createdAt?: DateTimeFilter<"TradeLog"> | Date | string
    updatedAt?: DateTimeFilter<"TradeLog"> | Date | string
    user?: XOR<UserScalarRelationFilter, UserWhereInput>
  }

  export type TradeLogOrderByWithRelationInput = {
    id?: SortOrder
    userId?: SortOrder
    pair?: SortOrderInput | SortOrder
    timeframe?: SortOrderInput | SortOrder
    session?: SortOrderInput | SortOrder
    action?: SortOrderInput | SortOrder
    pnl?: SortOrderInput | SortOrder
    notes?: SortOrderInput | SortOrder
    leverage?: SortOrderInput | SortOrder
    entry?: SortOrderInput | SortOrder
    stop?: SortOrderInput | SortOrder
    tp1?: SortOrderInput | SortOrder
    tp2?: SortOrderInput | SortOrder
    rr1?: SortOrderInput | SortOrder
    rr2?: SortOrderInput | SortOrder
    directionBias?: SortOrderInput | SortOrder
    eventType?: SortOrderInput | SortOrder
    sweepType?: SortOrderInput | SortOrder
    emaContext?: SortOrderInput | SortOrder
    reclaimConfirmed?: SortOrderInput | SortOrder
    planFollowed?: SortOrderInput | SortOrder
    ruleBreak?: SortOrderInput | SortOrder
    executionType?: SortOrderInput | SortOrder
    liquidityLevel?: SortOrderInput | SortOrder
    htfBias?: SortOrderInput | SortOrder
    entryTrigger?: SortOrderInput | SortOrder
    outcome?: SortOrderInput | SortOrder
    confidenceSelf?: SortOrderInput | SortOrder
    durationMinutes?: SortOrderInput | SortOrder
    emotionalPressure?: SortOrderInput | SortOrder
    setupQuality?: SortOrderInput | SortOrder
    disciplineScore?: SortOrderInput | SortOrder
    linkedEventId?: SortOrderInput | SortOrder
    screenshotUrl?: SortOrderInput | SortOrder
    aiScore?: SortOrderInput | SortOrder
    aiGrade?: SortOrderInput | SortOrder
    aiSummary?: SortOrderInput | SortOrder
    aiCoachingNote?: SortOrderInput | SortOrder
    aiStatus?: SortOrderInput | SortOrder
    setupScore?: SortOrderInput | SortOrder
    executionScore?: SortOrderInput | SortOrder
    managementScore?: SortOrderInput | SortOrder
    disciplineScoreAi?: SortOrderInput | SortOrder
    aiConfidence?: SortOrderInput | SortOrder
    chartRead?: SortOrderInput | SortOrder
    setupAssessment?: SortOrderInput | SortOrder
    executionAssessment?: SortOrderInput | SortOrder
    riskAssessment?: SortOrderInput | SortOrder
    biasAlignment?: SortOrderInput | SortOrder
    mistakeTags?: SortOrderInput | SortOrder
    whatWasGood?: SortOrderInput | SortOrder
    whatNeedsWork?: SortOrderInput | SortOrder
    usedScreenshot?: SortOrderInput | SortOrder
    aiPayload?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    user?: UserOrderByWithRelationInput
  }

  export type TradeLogWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: TradeLogWhereInput | TradeLogWhereInput[]
    OR?: TradeLogWhereInput[]
    NOT?: TradeLogWhereInput | TradeLogWhereInput[]
    userId?: StringFilter<"TradeLog"> | string
    pair?: StringNullableFilter<"TradeLog"> | string | null
    timeframe?: StringNullableFilter<"TradeLog"> | string | null
    session?: StringNullableFilter<"TradeLog"> | string | null
    action?: StringNullableFilter<"TradeLog"> | string | null
    pnl?: FloatNullableFilter<"TradeLog"> | number | null
    notes?: StringNullableFilter<"TradeLog"> | string | null
    leverage?: FloatNullableFilter<"TradeLog"> | number | null
    entry?: FloatNullableFilter<"TradeLog"> | number | null
    stop?: FloatNullableFilter<"TradeLog"> | number | null
    tp1?: FloatNullableFilter<"TradeLog"> | number | null
    tp2?: FloatNullableFilter<"TradeLog"> | number | null
    rr1?: FloatNullableFilter<"TradeLog"> | number | null
    rr2?: FloatNullableFilter<"TradeLog"> | number | null
    directionBias?: StringNullableFilter<"TradeLog"> | string | null
    eventType?: StringNullableFilter<"TradeLog"> | string | null
    sweepType?: StringNullableFilter<"TradeLog"> | string | null
    emaContext?: StringNullableFilter<"TradeLog"> | string | null
    reclaimConfirmed?: BoolNullableFilter<"TradeLog"> | boolean | null
    planFollowed?: StringNullableFilter<"TradeLog"> | string | null
    ruleBreak?: StringNullableFilter<"TradeLog"> | string | null
    executionType?: StringNullableFilter<"TradeLog"> | string | null
    liquidityLevel?: StringNullableFilter<"TradeLog"> | string | null
    htfBias?: StringNullableFilter<"TradeLog"> | string | null
    entryTrigger?: StringNullableFilter<"TradeLog"> | string | null
    outcome?: StringNullableFilter<"TradeLog"> | string | null
    confidenceSelf?: FloatNullableFilter<"TradeLog"> | number | null
    durationMinutes?: FloatNullableFilter<"TradeLog"> | number | null
    emotionalPressure?: FloatNullableFilter<"TradeLog"> | number | null
    setupQuality?: FloatNullableFilter<"TradeLog"> | number | null
    disciplineScore?: FloatNullableFilter<"TradeLog"> | number | null
    linkedEventId?: StringNullableFilter<"TradeLog"> | string | null
    screenshotUrl?: StringNullableFilter<"TradeLog"> | string | null
    aiScore?: IntNullableFilter<"TradeLog"> | number | null
    aiGrade?: StringNullableFilter<"TradeLog"> | string | null
    aiSummary?: StringNullableFilter<"TradeLog"> | string | null
    aiCoachingNote?: StringNullableFilter<"TradeLog"> | string | null
    aiStatus?: StringNullableFilter<"TradeLog"> | string | null
    setupScore?: IntNullableFilter<"TradeLog"> | number | null
    executionScore?: IntNullableFilter<"TradeLog"> | number | null
    managementScore?: IntNullableFilter<"TradeLog"> | number | null
    disciplineScoreAi?: IntNullableFilter<"TradeLog"> | number | null
    aiConfidence?: FloatNullableFilter<"TradeLog"> | number | null
    chartRead?: StringNullableFilter<"TradeLog"> | string | null
    setupAssessment?: StringNullableFilter<"TradeLog"> | string | null
    executionAssessment?: StringNullableFilter<"TradeLog"> | string | null
    riskAssessment?: StringNullableFilter<"TradeLog"> | string | null
    biasAlignment?: StringNullableFilter<"TradeLog"> | string | null
    mistakeTags?: JsonNullableFilter<"TradeLog">
    whatWasGood?: JsonNullableFilter<"TradeLog">
    whatNeedsWork?: JsonNullableFilter<"TradeLog">
    usedScreenshot?: BoolNullableFilter<"TradeLog"> | boolean | null
    aiPayload?: JsonNullableFilter<"TradeLog">
    createdAt?: DateTimeFilter<"TradeLog"> | Date | string
    updatedAt?: DateTimeFilter<"TradeLog"> | Date | string
    user?: XOR<UserScalarRelationFilter, UserWhereInput>
  }, "id">

  export type TradeLogOrderByWithAggregationInput = {
    id?: SortOrder
    userId?: SortOrder
    pair?: SortOrderInput | SortOrder
    timeframe?: SortOrderInput | SortOrder
    session?: SortOrderInput | SortOrder
    action?: SortOrderInput | SortOrder
    pnl?: SortOrderInput | SortOrder
    notes?: SortOrderInput | SortOrder
    leverage?: SortOrderInput | SortOrder
    entry?: SortOrderInput | SortOrder
    stop?: SortOrderInput | SortOrder
    tp1?: SortOrderInput | SortOrder
    tp2?: SortOrderInput | SortOrder
    rr1?: SortOrderInput | SortOrder
    rr2?: SortOrderInput | SortOrder
    directionBias?: SortOrderInput | SortOrder
    eventType?: SortOrderInput | SortOrder
    sweepType?: SortOrderInput | SortOrder
    emaContext?: SortOrderInput | SortOrder
    reclaimConfirmed?: SortOrderInput | SortOrder
    planFollowed?: SortOrderInput | SortOrder
    ruleBreak?: SortOrderInput | SortOrder
    executionType?: SortOrderInput | SortOrder
    liquidityLevel?: SortOrderInput | SortOrder
    htfBias?: SortOrderInput | SortOrder
    entryTrigger?: SortOrderInput | SortOrder
    outcome?: SortOrderInput | SortOrder
    confidenceSelf?: SortOrderInput | SortOrder
    durationMinutes?: SortOrderInput | SortOrder
    emotionalPressure?: SortOrderInput | SortOrder
    setupQuality?: SortOrderInput | SortOrder
    disciplineScore?: SortOrderInput | SortOrder
    linkedEventId?: SortOrderInput | SortOrder
    screenshotUrl?: SortOrderInput | SortOrder
    aiScore?: SortOrderInput | SortOrder
    aiGrade?: SortOrderInput | SortOrder
    aiSummary?: SortOrderInput | SortOrder
    aiCoachingNote?: SortOrderInput | SortOrder
    aiStatus?: SortOrderInput | SortOrder
    setupScore?: SortOrderInput | SortOrder
    executionScore?: SortOrderInput | SortOrder
    managementScore?: SortOrderInput | SortOrder
    disciplineScoreAi?: SortOrderInput | SortOrder
    aiConfidence?: SortOrderInput | SortOrder
    chartRead?: SortOrderInput | SortOrder
    setupAssessment?: SortOrderInput | SortOrder
    executionAssessment?: SortOrderInput | SortOrder
    riskAssessment?: SortOrderInput | SortOrder
    biasAlignment?: SortOrderInput | SortOrder
    mistakeTags?: SortOrderInput | SortOrder
    whatWasGood?: SortOrderInput | SortOrder
    whatNeedsWork?: SortOrderInput | SortOrder
    usedScreenshot?: SortOrderInput | SortOrder
    aiPayload?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: TradeLogCountOrderByAggregateInput
    _avg?: TradeLogAvgOrderByAggregateInput
    _max?: TradeLogMaxOrderByAggregateInput
    _min?: TradeLogMinOrderByAggregateInput
    _sum?: TradeLogSumOrderByAggregateInput
  }

  export type TradeLogScalarWhereWithAggregatesInput = {
    AND?: TradeLogScalarWhereWithAggregatesInput | TradeLogScalarWhereWithAggregatesInput[]
    OR?: TradeLogScalarWhereWithAggregatesInput[]
    NOT?: TradeLogScalarWhereWithAggregatesInput | TradeLogScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"TradeLog"> | string
    userId?: StringWithAggregatesFilter<"TradeLog"> | string
    pair?: StringNullableWithAggregatesFilter<"TradeLog"> | string | null
    timeframe?: StringNullableWithAggregatesFilter<"TradeLog"> | string | null
    session?: StringNullableWithAggregatesFilter<"TradeLog"> | string | null
    action?: StringNullableWithAggregatesFilter<"TradeLog"> | string | null
    pnl?: FloatNullableWithAggregatesFilter<"TradeLog"> | number | null
    notes?: StringNullableWithAggregatesFilter<"TradeLog"> | string | null
    leverage?: FloatNullableWithAggregatesFilter<"TradeLog"> | number | null
    entry?: FloatNullableWithAggregatesFilter<"TradeLog"> | number | null
    stop?: FloatNullableWithAggregatesFilter<"TradeLog"> | number | null
    tp1?: FloatNullableWithAggregatesFilter<"TradeLog"> | number | null
    tp2?: FloatNullableWithAggregatesFilter<"TradeLog"> | number | null
    rr1?: FloatNullableWithAggregatesFilter<"TradeLog"> | number | null
    rr2?: FloatNullableWithAggregatesFilter<"TradeLog"> | number | null
    directionBias?: StringNullableWithAggregatesFilter<"TradeLog"> | string | null
    eventType?: StringNullableWithAggregatesFilter<"TradeLog"> | string | null
    sweepType?: StringNullableWithAggregatesFilter<"TradeLog"> | string | null
    emaContext?: StringNullableWithAggregatesFilter<"TradeLog"> | string | null
    reclaimConfirmed?: BoolNullableWithAggregatesFilter<"TradeLog"> | boolean | null
    planFollowed?: StringNullableWithAggregatesFilter<"TradeLog"> | string | null
    ruleBreak?: StringNullableWithAggregatesFilter<"TradeLog"> | string | null
    executionType?: StringNullableWithAggregatesFilter<"TradeLog"> | string | null
    liquidityLevel?: StringNullableWithAggregatesFilter<"TradeLog"> | string | null
    htfBias?: StringNullableWithAggregatesFilter<"TradeLog"> | string | null
    entryTrigger?: StringNullableWithAggregatesFilter<"TradeLog"> | string | null
    outcome?: StringNullableWithAggregatesFilter<"TradeLog"> | string | null
    confidenceSelf?: FloatNullableWithAggregatesFilter<"TradeLog"> | number | null
    durationMinutes?: FloatNullableWithAggregatesFilter<"TradeLog"> | number | null
    emotionalPressure?: FloatNullableWithAggregatesFilter<"TradeLog"> | number | null
    setupQuality?: FloatNullableWithAggregatesFilter<"TradeLog"> | number | null
    disciplineScore?: FloatNullableWithAggregatesFilter<"TradeLog"> | number | null
    linkedEventId?: StringNullableWithAggregatesFilter<"TradeLog"> | string | null
    screenshotUrl?: StringNullableWithAggregatesFilter<"TradeLog"> | string | null
    aiScore?: IntNullableWithAggregatesFilter<"TradeLog"> | number | null
    aiGrade?: StringNullableWithAggregatesFilter<"TradeLog"> | string | null
    aiSummary?: StringNullableWithAggregatesFilter<"TradeLog"> | string | null
    aiCoachingNote?: StringNullableWithAggregatesFilter<"TradeLog"> | string | null
    aiStatus?: StringNullableWithAggregatesFilter<"TradeLog"> | string | null
    setupScore?: IntNullableWithAggregatesFilter<"TradeLog"> | number | null
    executionScore?: IntNullableWithAggregatesFilter<"TradeLog"> | number | null
    managementScore?: IntNullableWithAggregatesFilter<"TradeLog"> | number | null
    disciplineScoreAi?: IntNullableWithAggregatesFilter<"TradeLog"> | number | null
    aiConfidence?: FloatNullableWithAggregatesFilter<"TradeLog"> | number | null
    chartRead?: StringNullableWithAggregatesFilter<"TradeLog"> | string | null
    setupAssessment?: StringNullableWithAggregatesFilter<"TradeLog"> | string | null
    executionAssessment?: StringNullableWithAggregatesFilter<"TradeLog"> | string | null
    riskAssessment?: StringNullableWithAggregatesFilter<"TradeLog"> | string | null
    biasAlignment?: StringNullableWithAggregatesFilter<"TradeLog"> | string | null
    mistakeTags?: JsonNullableWithAggregatesFilter<"TradeLog">
    whatWasGood?: JsonNullableWithAggregatesFilter<"TradeLog">
    whatNeedsWork?: JsonNullableWithAggregatesFilter<"TradeLog">
    usedScreenshot?: BoolNullableWithAggregatesFilter<"TradeLog"> | boolean | null
    aiPayload?: JsonNullableWithAggregatesFilter<"TradeLog">
    createdAt?: DateTimeWithAggregatesFilter<"TradeLog"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"TradeLog"> | Date | string
  }

  export type UserCreateInput = {
    id?: string
    email: string
    passwordHash: string
    createdAt?: Date | string
    updatedAt?: Date | string
    stripeCustomerId?: string | null
    stripeSubId?: string | null
    stripePriceId?: string | null
    billingStatus?: string | null
    billingPlan?: string | null
    billingPeriodEnd?: Date | string | null
    isActive?: boolean
    logs?: TradeLogCreateNestedManyWithoutUserInput
  }

  export type UserUncheckedCreateInput = {
    id?: string
    email: string
    passwordHash: string
    createdAt?: Date | string
    updatedAt?: Date | string
    stripeCustomerId?: string | null
    stripeSubId?: string | null
    stripePriceId?: string | null
    billingStatus?: string | null
    billingPlan?: string | null
    billingPeriodEnd?: Date | string | null
    isActive?: boolean
    logs?: TradeLogUncheckedCreateNestedManyWithoutUserInput
  }

  export type UserUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    passwordHash?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    stripeCustomerId?: NullableStringFieldUpdateOperationsInput | string | null
    stripeSubId?: NullableStringFieldUpdateOperationsInput | string | null
    stripePriceId?: NullableStringFieldUpdateOperationsInput | string | null
    billingStatus?: NullableStringFieldUpdateOperationsInput | string | null
    billingPlan?: NullableStringFieldUpdateOperationsInput | string | null
    billingPeriodEnd?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
    logs?: TradeLogUpdateManyWithoutUserNestedInput
  }

  export type UserUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    passwordHash?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    stripeCustomerId?: NullableStringFieldUpdateOperationsInput | string | null
    stripeSubId?: NullableStringFieldUpdateOperationsInput | string | null
    stripePriceId?: NullableStringFieldUpdateOperationsInput | string | null
    billingStatus?: NullableStringFieldUpdateOperationsInput | string | null
    billingPlan?: NullableStringFieldUpdateOperationsInput | string | null
    billingPeriodEnd?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
    logs?: TradeLogUncheckedUpdateManyWithoutUserNestedInput
  }

  export type UserCreateManyInput = {
    id?: string
    email: string
    passwordHash: string
    createdAt?: Date | string
    updatedAt?: Date | string
    stripeCustomerId?: string | null
    stripeSubId?: string | null
    stripePriceId?: string | null
    billingStatus?: string | null
    billingPlan?: string | null
    billingPeriodEnd?: Date | string | null
    isActive?: boolean
  }

  export type UserUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    passwordHash?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    stripeCustomerId?: NullableStringFieldUpdateOperationsInput | string | null
    stripeSubId?: NullableStringFieldUpdateOperationsInput | string | null
    stripePriceId?: NullableStringFieldUpdateOperationsInput | string | null
    billingStatus?: NullableStringFieldUpdateOperationsInput | string | null
    billingPlan?: NullableStringFieldUpdateOperationsInput | string | null
    billingPeriodEnd?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
  }

  export type UserUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    passwordHash?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    stripeCustomerId?: NullableStringFieldUpdateOperationsInput | string | null
    stripeSubId?: NullableStringFieldUpdateOperationsInput | string | null
    stripePriceId?: NullableStringFieldUpdateOperationsInput | string | null
    billingStatus?: NullableStringFieldUpdateOperationsInput | string | null
    billingPlan?: NullableStringFieldUpdateOperationsInput | string | null
    billingPeriodEnd?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
  }

  export type TradeLogCreateInput = {
    id?: string
    pair?: string | null
    timeframe?: string | null
    session?: string | null
    action?: string | null
    pnl?: number | null
    notes?: string | null
    leverage?: number | null
    entry?: number | null
    stop?: number | null
    tp1?: number | null
    tp2?: number | null
    rr1?: number | null
    rr2?: number | null
    directionBias?: string | null
    eventType?: string | null
    sweepType?: string | null
    emaContext?: string | null
    reclaimConfirmed?: boolean | null
    planFollowed?: string | null
    ruleBreak?: string | null
    executionType?: string | null
    liquidityLevel?: string | null
    htfBias?: string | null
    entryTrigger?: string | null
    outcome?: string | null
    confidenceSelf?: number | null
    durationMinutes?: number | null
    emotionalPressure?: number | null
    setupQuality?: number | null
    disciplineScore?: number | null
    linkedEventId?: string | null
    screenshotUrl?: string | null
    aiScore?: number | null
    aiGrade?: string | null
    aiSummary?: string | null
    aiCoachingNote?: string | null
    aiStatus?: string | null
    setupScore?: number | null
    executionScore?: number | null
    managementScore?: number | null
    disciplineScoreAi?: number | null
    aiConfidence?: number | null
    chartRead?: string | null
    setupAssessment?: string | null
    executionAssessment?: string | null
    riskAssessment?: string | null
    biasAlignment?: string | null
    mistakeTags?: NullableJsonNullValueInput | InputJsonValue
    whatWasGood?: NullableJsonNullValueInput | InputJsonValue
    whatNeedsWork?: NullableJsonNullValueInput | InputJsonValue
    usedScreenshot?: boolean | null
    aiPayload?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    user: UserCreateNestedOneWithoutLogsInput
  }

  export type TradeLogUncheckedCreateInput = {
    id?: string
    userId: string
    pair?: string | null
    timeframe?: string | null
    session?: string | null
    action?: string | null
    pnl?: number | null
    notes?: string | null
    leverage?: number | null
    entry?: number | null
    stop?: number | null
    tp1?: number | null
    tp2?: number | null
    rr1?: number | null
    rr2?: number | null
    directionBias?: string | null
    eventType?: string | null
    sweepType?: string | null
    emaContext?: string | null
    reclaimConfirmed?: boolean | null
    planFollowed?: string | null
    ruleBreak?: string | null
    executionType?: string | null
    liquidityLevel?: string | null
    htfBias?: string | null
    entryTrigger?: string | null
    outcome?: string | null
    confidenceSelf?: number | null
    durationMinutes?: number | null
    emotionalPressure?: number | null
    setupQuality?: number | null
    disciplineScore?: number | null
    linkedEventId?: string | null
    screenshotUrl?: string | null
    aiScore?: number | null
    aiGrade?: string | null
    aiSummary?: string | null
    aiCoachingNote?: string | null
    aiStatus?: string | null
    setupScore?: number | null
    executionScore?: number | null
    managementScore?: number | null
    disciplineScoreAi?: number | null
    aiConfidence?: number | null
    chartRead?: string | null
    setupAssessment?: string | null
    executionAssessment?: string | null
    riskAssessment?: string | null
    biasAlignment?: string | null
    mistakeTags?: NullableJsonNullValueInput | InputJsonValue
    whatWasGood?: NullableJsonNullValueInput | InputJsonValue
    whatNeedsWork?: NullableJsonNullValueInput | InputJsonValue
    usedScreenshot?: boolean | null
    aiPayload?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type TradeLogUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    pair?: NullableStringFieldUpdateOperationsInput | string | null
    timeframe?: NullableStringFieldUpdateOperationsInput | string | null
    session?: NullableStringFieldUpdateOperationsInput | string | null
    action?: NullableStringFieldUpdateOperationsInput | string | null
    pnl?: NullableFloatFieldUpdateOperationsInput | number | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    leverage?: NullableFloatFieldUpdateOperationsInput | number | null
    entry?: NullableFloatFieldUpdateOperationsInput | number | null
    stop?: NullableFloatFieldUpdateOperationsInput | number | null
    tp1?: NullableFloatFieldUpdateOperationsInput | number | null
    tp2?: NullableFloatFieldUpdateOperationsInput | number | null
    rr1?: NullableFloatFieldUpdateOperationsInput | number | null
    rr2?: NullableFloatFieldUpdateOperationsInput | number | null
    directionBias?: NullableStringFieldUpdateOperationsInput | string | null
    eventType?: NullableStringFieldUpdateOperationsInput | string | null
    sweepType?: NullableStringFieldUpdateOperationsInput | string | null
    emaContext?: NullableStringFieldUpdateOperationsInput | string | null
    reclaimConfirmed?: NullableBoolFieldUpdateOperationsInput | boolean | null
    planFollowed?: NullableStringFieldUpdateOperationsInput | string | null
    ruleBreak?: NullableStringFieldUpdateOperationsInput | string | null
    executionType?: NullableStringFieldUpdateOperationsInput | string | null
    liquidityLevel?: NullableStringFieldUpdateOperationsInput | string | null
    htfBias?: NullableStringFieldUpdateOperationsInput | string | null
    entryTrigger?: NullableStringFieldUpdateOperationsInput | string | null
    outcome?: NullableStringFieldUpdateOperationsInput | string | null
    confidenceSelf?: NullableFloatFieldUpdateOperationsInput | number | null
    durationMinutes?: NullableFloatFieldUpdateOperationsInput | number | null
    emotionalPressure?: NullableFloatFieldUpdateOperationsInput | number | null
    setupQuality?: NullableFloatFieldUpdateOperationsInput | number | null
    disciplineScore?: NullableFloatFieldUpdateOperationsInput | number | null
    linkedEventId?: NullableStringFieldUpdateOperationsInput | string | null
    screenshotUrl?: NullableStringFieldUpdateOperationsInput | string | null
    aiScore?: NullableIntFieldUpdateOperationsInput | number | null
    aiGrade?: NullableStringFieldUpdateOperationsInput | string | null
    aiSummary?: NullableStringFieldUpdateOperationsInput | string | null
    aiCoachingNote?: NullableStringFieldUpdateOperationsInput | string | null
    aiStatus?: NullableStringFieldUpdateOperationsInput | string | null
    setupScore?: NullableIntFieldUpdateOperationsInput | number | null
    executionScore?: NullableIntFieldUpdateOperationsInput | number | null
    managementScore?: NullableIntFieldUpdateOperationsInput | number | null
    disciplineScoreAi?: NullableIntFieldUpdateOperationsInput | number | null
    aiConfidence?: NullableFloatFieldUpdateOperationsInput | number | null
    chartRead?: NullableStringFieldUpdateOperationsInput | string | null
    setupAssessment?: NullableStringFieldUpdateOperationsInput | string | null
    executionAssessment?: NullableStringFieldUpdateOperationsInput | string | null
    riskAssessment?: NullableStringFieldUpdateOperationsInput | string | null
    biasAlignment?: NullableStringFieldUpdateOperationsInput | string | null
    mistakeTags?: NullableJsonNullValueInput | InputJsonValue
    whatWasGood?: NullableJsonNullValueInput | InputJsonValue
    whatNeedsWork?: NullableJsonNullValueInput | InputJsonValue
    usedScreenshot?: NullableBoolFieldUpdateOperationsInput | boolean | null
    aiPayload?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    user?: UserUpdateOneRequiredWithoutLogsNestedInput
  }

  export type TradeLogUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    pair?: NullableStringFieldUpdateOperationsInput | string | null
    timeframe?: NullableStringFieldUpdateOperationsInput | string | null
    session?: NullableStringFieldUpdateOperationsInput | string | null
    action?: NullableStringFieldUpdateOperationsInput | string | null
    pnl?: NullableFloatFieldUpdateOperationsInput | number | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    leverage?: NullableFloatFieldUpdateOperationsInput | number | null
    entry?: NullableFloatFieldUpdateOperationsInput | number | null
    stop?: NullableFloatFieldUpdateOperationsInput | number | null
    tp1?: NullableFloatFieldUpdateOperationsInput | number | null
    tp2?: NullableFloatFieldUpdateOperationsInput | number | null
    rr1?: NullableFloatFieldUpdateOperationsInput | number | null
    rr2?: NullableFloatFieldUpdateOperationsInput | number | null
    directionBias?: NullableStringFieldUpdateOperationsInput | string | null
    eventType?: NullableStringFieldUpdateOperationsInput | string | null
    sweepType?: NullableStringFieldUpdateOperationsInput | string | null
    emaContext?: NullableStringFieldUpdateOperationsInput | string | null
    reclaimConfirmed?: NullableBoolFieldUpdateOperationsInput | boolean | null
    planFollowed?: NullableStringFieldUpdateOperationsInput | string | null
    ruleBreak?: NullableStringFieldUpdateOperationsInput | string | null
    executionType?: NullableStringFieldUpdateOperationsInput | string | null
    liquidityLevel?: NullableStringFieldUpdateOperationsInput | string | null
    htfBias?: NullableStringFieldUpdateOperationsInput | string | null
    entryTrigger?: NullableStringFieldUpdateOperationsInput | string | null
    outcome?: NullableStringFieldUpdateOperationsInput | string | null
    confidenceSelf?: NullableFloatFieldUpdateOperationsInput | number | null
    durationMinutes?: NullableFloatFieldUpdateOperationsInput | number | null
    emotionalPressure?: NullableFloatFieldUpdateOperationsInput | number | null
    setupQuality?: NullableFloatFieldUpdateOperationsInput | number | null
    disciplineScore?: NullableFloatFieldUpdateOperationsInput | number | null
    linkedEventId?: NullableStringFieldUpdateOperationsInput | string | null
    screenshotUrl?: NullableStringFieldUpdateOperationsInput | string | null
    aiScore?: NullableIntFieldUpdateOperationsInput | number | null
    aiGrade?: NullableStringFieldUpdateOperationsInput | string | null
    aiSummary?: NullableStringFieldUpdateOperationsInput | string | null
    aiCoachingNote?: NullableStringFieldUpdateOperationsInput | string | null
    aiStatus?: NullableStringFieldUpdateOperationsInput | string | null
    setupScore?: NullableIntFieldUpdateOperationsInput | number | null
    executionScore?: NullableIntFieldUpdateOperationsInput | number | null
    managementScore?: NullableIntFieldUpdateOperationsInput | number | null
    disciplineScoreAi?: NullableIntFieldUpdateOperationsInput | number | null
    aiConfidence?: NullableFloatFieldUpdateOperationsInput | number | null
    chartRead?: NullableStringFieldUpdateOperationsInput | string | null
    setupAssessment?: NullableStringFieldUpdateOperationsInput | string | null
    executionAssessment?: NullableStringFieldUpdateOperationsInput | string | null
    riskAssessment?: NullableStringFieldUpdateOperationsInput | string | null
    biasAlignment?: NullableStringFieldUpdateOperationsInput | string | null
    mistakeTags?: NullableJsonNullValueInput | InputJsonValue
    whatWasGood?: NullableJsonNullValueInput | InputJsonValue
    whatNeedsWork?: NullableJsonNullValueInput | InputJsonValue
    usedScreenshot?: NullableBoolFieldUpdateOperationsInput | boolean | null
    aiPayload?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TradeLogCreateManyInput = {
    id?: string
    userId: string
    pair?: string | null
    timeframe?: string | null
    session?: string | null
    action?: string | null
    pnl?: number | null
    notes?: string | null
    leverage?: number | null
    entry?: number | null
    stop?: number | null
    tp1?: number | null
    tp2?: number | null
    rr1?: number | null
    rr2?: number | null
    directionBias?: string | null
    eventType?: string | null
    sweepType?: string | null
    emaContext?: string | null
    reclaimConfirmed?: boolean | null
    planFollowed?: string | null
    ruleBreak?: string | null
    executionType?: string | null
    liquidityLevel?: string | null
    htfBias?: string | null
    entryTrigger?: string | null
    outcome?: string | null
    confidenceSelf?: number | null
    durationMinutes?: number | null
    emotionalPressure?: number | null
    setupQuality?: number | null
    disciplineScore?: number | null
    linkedEventId?: string | null
    screenshotUrl?: string | null
    aiScore?: number | null
    aiGrade?: string | null
    aiSummary?: string | null
    aiCoachingNote?: string | null
    aiStatus?: string | null
    setupScore?: number | null
    executionScore?: number | null
    managementScore?: number | null
    disciplineScoreAi?: number | null
    aiConfidence?: number | null
    chartRead?: string | null
    setupAssessment?: string | null
    executionAssessment?: string | null
    riskAssessment?: string | null
    biasAlignment?: string | null
    mistakeTags?: NullableJsonNullValueInput | InputJsonValue
    whatWasGood?: NullableJsonNullValueInput | InputJsonValue
    whatNeedsWork?: NullableJsonNullValueInput | InputJsonValue
    usedScreenshot?: boolean | null
    aiPayload?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type TradeLogUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    pair?: NullableStringFieldUpdateOperationsInput | string | null
    timeframe?: NullableStringFieldUpdateOperationsInput | string | null
    session?: NullableStringFieldUpdateOperationsInput | string | null
    action?: NullableStringFieldUpdateOperationsInput | string | null
    pnl?: NullableFloatFieldUpdateOperationsInput | number | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    leverage?: NullableFloatFieldUpdateOperationsInput | number | null
    entry?: NullableFloatFieldUpdateOperationsInput | number | null
    stop?: NullableFloatFieldUpdateOperationsInput | number | null
    tp1?: NullableFloatFieldUpdateOperationsInput | number | null
    tp2?: NullableFloatFieldUpdateOperationsInput | number | null
    rr1?: NullableFloatFieldUpdateOperationsInput | number | null
    rr2?: NullableFloatFieldUpdateOperationsInput | number | null
    directionBias?: NullableStringFieldUpdateOperationsInput | string | null
    eventType?: NullableStringFieldUpdateOperationsInput | string | null
    sweepType?: NullableStringFieldUpdateOperationsInput | string | null
    emaContext?: NullableStringFieldUpdateOperationsInput | string | null
    reclaimConfirmed?: NullableBoolFieldUpdateOperationsInput | boolean | null
    planFollowed?: NullableStringFieldUpdateOperationsInput | string | null
    ruleBreak?: NullableStringFieldUpdateOperationsInput | string | null
    executionType?: NullableStringFieldUpdateOperationsInput | string | null
    liquidityLevel?: NullableStringFieldUpdateOperationsInput | string | null
    htfBias?: NullableStringFieldUpdateOperationsInput | string | null
    entryTrigger?: NullableStringFieldUpdateOperationsInput | string | null
    outcome?: NullableStringFieldUpdateOperationsInput | string | null
    confidenceSelf?: NullableFloatFieldUpdateOperationsInput | number | null
    durationMinutes?: NullableFloatFieldUpdateOperationsInput | number | null
    emotionalPressure?: NullableFloatFieldUpdateOperationsInput | number | null
    setupQuality?: NullableFloatFieldUpdateOperationsInput | number | null
    disciplineScore?: NullableFloatFieldUpdateOperationsInput | number | null
    linkedEventId?: NullableStringFieldUpdateOperationsInput | string | null
    screenshotUrl?: NullableStringFieldUpdateOperationsInput | string | null
    aiScore?: NullableIntFieldUpdateOperationsInput | number | null
    aiGrade?: NullableStringFieldUpdateOperationsInput | string | null
    aiSummary?: NullableStringFieldUpdateOperationsInput | string | null
    aiCoachingNote?: NullableStringFieldUpdateOperationsInput | string | null
    aiStatus?: NullableStringFieldUpdateOperationsInput | string | null
    setupScore?: NullableIntFieldUpdateOperationsInput | number | null
    executionScore?: NullableIntFieldUpdateOperationsInput | number | null
    managementScore?: NullableIntFieldUpdateOperationsInput | number | null
    disciplineScoreAi?: NullableIntFieldUpdateOperationsInput | number | null
    aiConfidence?: NullableFloatFieldUpdateOperationsInput | number | null
    chartRead?: NullableStringFieldUpdateOperationsInput | string | null
    setupAssessment?: NullableStringFieldUpdateOperationsInput | string | null
    executionAssessment?: NullableStringFieldUpdateOperationsInput | string | null
    riskAssessment?: NullableStringFieldUpdateOperationsInput | string | null
    biasAlignment?: NullableStringFieldUpdateOperationsInput | string | null
    mistakeTags?: NullableJsonNullValueInput | InputJsonValue
    whatWasGood?: NullableJsonNullValueInput | InputJsonValue
    whatNeedsWork?: NullableJsonNullValueInput | InputJsonValue
    usedScreenshot?: NullableBoolFieldUpdateOperationsInput | boolean | null
    aiPayload?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TradeLogUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    pair?: NullableStringFieldUpdateOperationsInput | string | null
    timeframe?: NullableStringFieldUpdateOperationsInput | string | null
    session?: NullableStringFieldUpdateOperationsInput | string | null
    action?: NullableStringFieldUpdateOperationsInput | string | null
    pnl?: NullableFloatFieldUpdateOperationsInput | number | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    leverage?: NullableFloatFieldUpdateOperationsInput | number | null
    entry?: NullableFloatFieldUpdateOperationsInput | number | null
    stop?: NullableFloatFieldUpdateOperationsInput | number | null
    tp1?: NullableFloatFieldUpdateOperationsInput | number | null
    tp2?: NullableFloatFieldUpdateOperationsInput | number | null
    rr1?: NullableFloatFieldUpdateOperationsInput | number | null
    rr2?: NullableFloatFieldUpdateOperationsInput | number | null
    directionBias?: NullableStringFieldUpdateOperationsInput | string | null
    eventType?: NullableStringFieldUpdateOperationsInput | string | null
    sweepType?: NullableStringFieldUpdateOperationsInput | string | null
    emaContext?: NullableStringFieldUpdateOperationsInput | string | null
    reclaimConfirmed?: NullableBoolFieldUpdateOperationsInput | boolean | null
    planFollowed?: NullableStringFieldUpdateOperationsInput | string | null
    ruleBreak?: NullableStringFieldUpdateOperationsInput | string | null
    executionType?: NullableStringFieldUpdateOperationsInput | string | null
    liquidityLevel?: NullableStringFieldUpdateOperationsInput | string | null
    htfBias?: NullableStringFieldUpdateOperationsInput | string | null
    entryTrigger?: NullableStringFieldUpdateOperationsInput | string | null
    outcome?: NullableStringFieldUpdateOperationsInput | string | null
    confidenceSelf?: NullableFloatFieldUpdateOperationsInput | number | null
    durationMinutes?: NullableFloatFieldUpdateOperationsInput | number | null
    emotionalPressure?: NullableFloatFieldUpdateOperationsInput | number | null
    setupQuality?: NullableFloatFieldUpdateOperationsInput | number | null
    disciplineScore?: NullableFloatFieldUpdateOperationsInput | number | null
    linkedEventId?: NullableStringFieldUpdateOperationsInput | string | null
    screenshotUrl?: NullableStringFieldUpdateOperationsInput | string | null
    aiScore?: NullableIntFieldUpdateOperationsInput | number | null
    aiGrade?: NullableStringFieldUpdateOperationsInput | string | null
    aiSummary?: NullableStringFieldUpdateOperationsInput | string | null
    aiCoachingNote?: NullableStringFieldUpdateOperationsInput | string | null
    aiStatus?: NullableStringFieldUpdateOperationsInput | string | null
    setupScore?: NullableIntFieldUpdateOperationsInput | number | null
    executionScore?: NullableIntFieldUpdateOperationsInput | number | null
    managementScore?: NullableIntFieldUpdateOperationsInput | number | null
    disciplineScoreAi?: NullableIntFieldUpdateOperationsInput | number | null
    aiConfidence?: NullableFloatFieldUpdateOperationsInput | number | null
    chartRead?: NullableStringFieldUpdateOperationsInput | string | null
    setupAssessment?: NullableStringFieldUpdateOperationsInput | string | null
    executionAssessment?: NullableStringFieldUpdateOperationsInput | string | null
    riskAssessment?: NullableStringFieldUpdateOperationsInput | string | null
    biasAlignment?: NullableStringFieldUpdateOperationsInput | string | null
    mistakeTags?: NullableJsonNullValueInput | InputJsonValue
    whatWasGood?: NullableJsonNullValueInput | InputJsonValue
    whatNeedsWork?: NullableJsonNullValueInput | InputJsonValue
    usedScreenshot?: NullableBoolFieldUpdateOperationsInput | boolean | null
    aiPayload?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type StringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type DateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type StringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type DateTimeNullableFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null
  }

  export type BoolFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolFilter<$PrismaModel> | boolean
  }

  export type TradeLogListRelationFilter = {
    every?: TradeLogWhereInput
    some?: TradeLogWhereInput
    none?: TradeLogWhereInput
  }

  export type SortOrderInput = {
    sort: SortOrder
    nulls?: NullsOrder
  }

  export type TradeLogOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type UserCountOrderByAggregateInput = {
    id?: SortOrder
    email?: SortOrder
    passwordHash?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    stripeCustomerId?: SortOrder
    stripeSubId?: SortOrder
    stripePriceId?: SortOrder
    billingStatus?: SortOrder
    billingPlan?: SortOrder
    billingPeriodEnd?: SortOrder
    isActive?: SortOrder
  }

  export type UserMaxOrderByAggregateInput = {
    id?: SortOrder
    email?: SortOrder
    passwordHash?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    stripeCustomerId?: SortOrder
    stripeSubId?: SortOrder
    stripePriceId?: SortOrder
    billingStatus?: SortOrder
    billingPlan?: SortOrder
    billingPeriodEnd?: SortOrder
    isActive?: SortOrder
  }

  export type UserMinOrderByAggregateInput = {
    id?: SortOrder
    email?: SortOrder
    passwordHash?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    stripeCustomerId?: SortOrder
    stripeSubId?: SortOrder
    stripePriceId?: SortOrder
    billingStatus?: SortOrder
    billingPlan?: SortOrder
    billingPeriodEnd?: SortOrder
    isActive?: SortOrder
  }

  export type StringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type DateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type StringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type DateTimeNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableWithAggregatesFilter<$PrismaModel> | Date | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedDateTimeNullableFilter<$PrismaModel>
    _max?: NestedDateTimeNullableFilter<$PrismaModel>
  }

  export type BoolWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolWithAggregatesFilter<$PrismaModel> | boolean
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedBoolFilter<$PrismaModel>
    _max?: NestedBoolFilter<$PrismaModel>
  }

  export type FloatNullableFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel> | null
    in?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatNullableFilter<$PrismaModel> | number | null
  }

  export type BoolNullableFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel> | null
    not?: NestedBoolNullableFilter<$PrismaModel> | boolean | null
  }

  export type IntNullableFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableFilter<$PrismaModel> | number | null
  }
  export type JsonNullableFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<Required<JsonNullableFilterBase<$PrismaModel>>, Exclude<keyof Required<JsonNullableFilterBase<$PrismaModel>>, 'path'>>,
        Required<JsonNullableFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<JsonNullableFilterBase<$PrismaModel>>, 'path'>>

  export type JsonNullableFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
  }

  export type UserScalarRelationFilter = {
    is?: UserWhereInput
    isNot?: UserWhereInput
  }

  export type TradeLogCountOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    pair?: SortOrder
    timeframe?: SortOrder
    session?: SortOrder
    action?: SortOrder
    pnl?: SortOrder
    notes?: SortOrder
    leverage?: SortOrder
    entry?: SortOrder
    stop?: SortOrder
    tp1?: SortOrder
    tp2?: SortOrder
    rr1?: SortOrder
    rr2?: SortOrder
    directionBias?: SortOrder
    eventType?: SortOrder
    sweepType?: SortOrder
    emaContext?: SortOrder
    reclaimConfirmed?: SortOrder
    planFollowed?: SortOrder
    ruleBreak?: SortOrder
    executionType?: SortOrder
    liquidityLevel?: SortOrder
    htfBias?: SortOrder
    entryTrigger?: SortOrder
    outcome?: SortOrder
    confidenceSelf?: SortOrder
    durationMinutes?: SortOrder
    emotionalPressure?: SortOrder
    setupQuality?: SortOrder
    disciplineScore?: SortOrder
    linkedEventId?: SortOrder
    screenshotUrl?: SortOrder
    aiScore?: SortOrder
    aiGrade?: SortOrder
    aiSummary?: SortOrder
    aiCoachingNote?: SortOrder
    aiStatus?: SortOrder
    setupScore?: SortOrder
    executionScore?: SortOrder
    managementScore?: SortOrder
    disciplineScoreAi?: SortOrder
    aiConfidence?: SortOrder
    chartRead?: SortOrder
    setupAssessment?: SortOrder
    executionAssessment?: SortOrder
    riskAssessment?: SortOrder
    biasAlignment?: SortOrder
    mistakeTags?: SortOrder
    whatWasGood?: SortOrder
    whatNeedsWork?: SortOrder
    usedScreenshot?: SortOrder
    aiPayload?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type TradeLogAvgOrderByAggregateInput = {
    pnl?: SortOrder
    leverage?: SortOrder
    entry?: SortOrder
    stop?: SortOrder
    tp1?: SortOrder
    tp2?: SortOrder
    rr1?: SortOrder
    rr2?: SortOrder
    confidenceSelf?: SortOrder
    durationMinutes?: SortOrder
    emotionalPressure?: SortOrder
    setupQuality?: SortOrder
    disciplineScore?: SortOrder
    aiScore?: SortOrder
    setupScore?: SortOrder
    executionScore?: SortOrder
    managementScore?: SortOrder
    disciplineScoreAi?: SortOrder
    aiConfidence?: SortOrder
  }

  export type TradeLogMaxOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    pair?: SortOrder
    timeframe?: SortOrder
    session?: SortOrder
    action?: SortOrder
    pnl?: SortOrder
    notes?: SortOrder
    leverage?: SortOrder
    entry?: SortOrder
    stop?: SortOrder
    tp1?: SortOrder
    tp2?: SortOrder
    rr1?: SortOrder
    rr2?: SortOrder
    directionBias?: SortOrder
    eventType?: SortOrder
    sweepType?: SortOrder
    emaContext?: SortOrder
    reclaimConfirmed?: SortOrder
    planFollowed?: SortOrder
    ruleBreak?: SortOrder
    executionType?: SortOrder
    liquidityLevel?: SortOrder
    htfBias?: SortOrder
    entryTrigger?: SortOrder
    outcome?: SortOrder
    confidenceSelf?: SortOrder
    durationMinutes?: SortOrder
    emotionalPressure?: SortOrder
    setupQuality?: SortOrder
    disciplineScore?: SortOrder
    linkedEventId?: SortOrder
    screenshotUrl?: SortOrder
    aiScore?: SortOrder
    aiGrade?: SortOrder
    aiSummary?: SortOrder
    aiCoachingNote?: SortOrder
    aiStatus?: SortOrder
    setupScore?: SortOrder
    executionScore?: SortOrder
    managementScore?: SortOrder
    disciplineScoreAi?: SortOrder
    aiConfidence?: SortOrder
    chartRead?: SortOrder
    setupAssessment?: SortOrder
    executionAssessment?: SortOrder
    riskAssessment?: SortOrder
    biasAlignment?: SortOrder
    usedScreenshot?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type TradeLogMinOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    pair?: SortOrder
    timeframe?: SortOrder
    session?: SortOrder
    action?: SortOrder
    pnl?: SortOrder
    notes?: SortOrder
    leverage?: SortOrder
    entry?: SortOrder
    stop?: SortOrder
    tp1?: SortOrder
    tp2?: SortOrder
    rr1?: SortOrder
    rr2?: SortOrder
    directionBias?: SortOrder
    eventType?: SortOrder
    sweepType?: SortOrder
    emaContext?: SortOrder
    reclaimConfirmed?: SortOrder
    planFollowed?: SortOrder
    ruleBreak?: SortOrder
    executionType?: SortOrder
    liquidityLevel?: SortOrder
    htfBias?: SortOrder
    entryTrigger?: SortOrder
    outcome?: SortOrder
    confidenceSelf?: SortOrder
    durationMinutes?: SortOrder
    emotionalPressure?: SortOrder
    setupQuality?: SortOrder
    disciplineScore?: SortOrder
    linkedEventId?: SortOrder
    screenshotUrl?: SortOrder
    aiScore?: SortOrder
    aiGrade?: SortOrder
    aiSummary?: SortOrder
    aiCoachingNote?: SortOrder
    aiStatus?: SortOrder
    setupScore?: SortOrder
    executionScore?: SortOrder
    managementScore?: SortOrder
    disciplineScoreAi?: SortOrder
    aiConfidence?: SortOrder
    chartRead?: SortOrder
    setupAssessment?: SortOrder
    executionAssessment?: SortOrder
    riskAssessment?: SortOrder
    biasAlignment?: SortOrder
    usedScreenshot?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type TradeLogSumOrderByAggregateInput = {
    pnl?: SortOrder
    leverage?: SortOrder
    entry?: SortOrder
    stop?: SortOrder
    tp1?: SortOrder
    tp2?: SortOrder
    rr1?: SortOrder
    rr2?: SortOrder
    confidenceSelf?: SortOrder
    durationMinutes?: SortOrder
    emotionalPressure?: SortOrder
    setupQuality?: SortOrder
    disciplineScore?: SortOrder
    aiScore?: SortOrder
    setupScore?: SortOrder
    executionScore?: SortOrder
    managementScore?: SortOrder
    disciplineScoreAi?: SortOrder
    aiConfidence?: SortOrder
  }

  export type FloatNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel> | null
    in?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatNullableWithAggregatesFilter<$PrismaModel> | number | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedFloatNullableFilter<$PrismaModel>
    _sum?: NestedFloatNullableFilter<$PrismaModel>
    _min?: NestedFloatNullableFilter<$PrismaModel>
    _max?: NestedFloatNullableFilter<$PrismaModel>
  }

  export type BoolNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel> | null
    not?: NestedBoolNullableWithAggregatesFilter<$PrismaModel> | boolean | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedBoolNullableFilter<$PrismaModel>
    _max?: NestedBoolNullableFilter<$PrismaModel>
  }

  export type IntNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableWithAggregatesFilter<$PrismaModel> | number | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedFloatNullableFilter<$PrismaModel>
    _sum?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedIntNullableFilter<$PrismaModel>
    _max?: NestedIntNullableFilter<$PrismaModel>
  }
  export type JsonNullableWithAggregatesFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>, Exclude<keyof Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>, 'path'>>,
        Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>, 'path'>>

  export type JsonNullableWithAggregatesFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedJsonNullableFilter<$PrismaModel>
    _max?: NestedJsonNullableFilter<$PrismaModel>
  }

  export type TradeLogCreateNestedManyWithoutUserInput = {
    create?: XOR<TradeLogCreateWithoutUserInput, TradeLogUncheckedCreateWithoutUserInput> | TradeLogCreateWithoutUserInput[] | TradeLogUncheckedCreateWithoutUserInput[]
    connectOrCreate?: TradeLogCreateOrConnectWithoutUserInput | TradeLogCreateOrConnectWithoutUserInput[]
    createMany?: TradeLogCreateManyUserInputEnvelope
    connect?: TradeLogWhereUniqueInput | TradeLogWhereUniqueInput[]
  }

  export type TradeLogUncheckedCreateNestedManyWithoutUserInput = {
    create?: XOR<TradeLogCreateWithoutUserInput, TradeLogUncheckedCreateWithoutUserInput> | TradeLogCreateWithoutUserInput[] | TradeLogUncheckedCreateWithoutUserInput[]
    connectOrCreate?: TradeLogCreateOrConnectWithoutUserInput | TradeLogCreateOrConnectWithoutUserInput[]
    createMany?: TradeLogCreateManyUserInputEnvelope
    connect?: TradeLogWhereUniqueInput | TradeLogWhereUniqueInput[]
  }

  export type StringFieldUpdateOperationsInput = {
    set?: string
  }

  export type DateTimeFieldUpdateOperationsInput = {
    set?: Date | string
  }

  export type NullableStringFieldUpdateOperationsInput = {
    set?: string | null
  }

  export type NullableDateTimeFieldUpdateOperationsInput = {
    set?: Date | string | null
  }

  export type BoolFieldUpdateOperationsInput = {
    set?: boolean
  }

  export type TradeLogUpdateManyWithoutUserNestedInput = {
    create?: XOR<TradeLogCreateWithoutUserInput, TradeLogUncheckedCreateWithoutUserInput> | TradeLogCreateWithoutUserInput[] | TradeLogUncheckedCreateWithoutUserInput[]
    connectOrCreate?: TradeLogCreateOrConnectWithoutUserInput | TradeLogCreateOrConnectWithoutUserInput[]
    upsert?: TradeLogUpsertWithWhereUniqueWithoutUserInput | TradeLogUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: TradeLogCreateManyUserInputEnvelope
    set?: TradeLogWhereUniqueInput | TradeLogWhereUniqueInput[]
    disconnect?: TradeLogWhereUniqueInput | TradeLogWhereUniqueInput[]
    delete?: TradeLogWhereUniqueInput | TradeLogWhereUniqueInput[]
    connect?: TradeLogWhereUniqueInput | TradeLogWhereUniqueInput[]
    update?: TradeLogUpdateWithWhereUniqueWithoutUserInput | TradeLogUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: TradeLogUpdateManyWithWhereWithoutUserInput | TradeLogUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: TradeLogScalarWhereInput | TradeLogScalarWhereInput[]
  }

  export type TradeLogUncheckedUpdateManyWithoutUserNestedInput = {
    create?: XOR<TradeLogCreateWithoutUserInput, TradeLogUncheckedCreateWithoutUserInput> | TradeLogCreateWithoutUserInput[] | TradeLogUncheckedCreateWithoutUserInput[]
    connectOrCreate?: TradeLogCreateOrConnectWithoutUserInput | TradeLogCreateOrConnectWithoutUserInput[]
    upsert?: TradeLogUpsertWithWhereUniqueWithoutUserInput | TradeLogUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: TradeLogCreateManyUserInputEnvelope
    set?: TradeLogWhereUniqueInput | TradeLogWhereUniqueInput[]
    disconnect?: TradeLogWhereUniqueInput | TradeLogWhereUniqueInput[]
    delete?: TradeLogWhereUniqueInput | TradeLogWhereUniqueInput[]
    connect?: TradeLogWhereUniqueInput | TradeLogWhereUniqueInput[]
    update?: TradeLogUpdateWithWhereUniqueWithoutUserInput | TradeLogUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: TradeLogUpdateManyWithWhereWithoutUserInput | TradeLogUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: TradeLogScalarWhereInput | TradeLogScalarWhereInput[]
  }

  export type UserCreateNestedOneWithoutLogsInput = {
    create?: XOR<UserCreateWithoutLogsInput, UserUncheckedCreateWithoutLogsInput>
    connectOrCreate?: UserCreateOrConnectWithoutLogsInput
    connect?: UserWhereUniqueInput
  }

  export type NullableFloatFieldUpdateOperationsInput = {
    set?: number | null
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type NullableBoolFieldUpdateOperationsInput = {
    set?: boolean | null
  }

  export type NullableIntFieldUpdateOperationsInput = {
    set?: number | null
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type UserUpdateOneRequiredWithoutLogsNestedInput = {
    create?: XOR<UserCreateWithoutLogsInput, UserUncheckedCreateWithoutLogsInput>
    connectOrCreate?: UserCreateOrConnectWithoutLogsInput
    upsert?: UserUpsertWithoutLogsInput
    connect?: UserWhereUniqueInput
    update?: XOR<XOR<UserUpdateToOneWithWhereWithoutLogsInput, UserUpdateWithoutLogsInput>, UserUncheckedUpdateWithoutLogsInput>
  }

  export type NestedStringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type NestedDateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type NestedStringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type NestedDateTimeNullableFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null
  }

  export type NestedBoolFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolFilter<$PrismaModel> | boolean
  }

  export type NestedStringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type NestedIntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type NestedDateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type NestedStringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type NestedIntNullableFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableFilter<$PrismaModel> | number | null
  }

  export type NestedDateTimeNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableWithAggregatesFilter<$PrismaModel> | Date | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedDateTimeNullableFilter<$PrismaModel>
    _max?: NestedDateTimeNullableFilter<$PrismaModel>
  }

  export type NestedBoolWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolWithAggregatesFilter<$PrismaModel> | boolean
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedBoolFilter<$PrismaModel>
    _max?: NestedBoolFilter<$PrismaModel>
  }

  export type NestedFloatNullableFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel> | null
    in?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatNullableFilter<$PrismaModel> | number | null
  }

  export type NestedBoolNullableFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel> | null
    not?: NestedBoolNullableFilter<$PrismaModel> | boolean | null
  }

  export type NestedFloatNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel> | null
    in?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatNullableWithAggregatesFilter<$PrismaModel> | number | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedFloatNullableFilter<$PrismaModel>
    _sum?: NestedFloatNullableFilter<$PrismaModel>
    _min?: NestedFloatNullableFilter<$PrismaModel>
    _max?: NestedFloatNullableFilter<$PrismaModel>
  }

  export type NestedBoolNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel> | null
    not?: NestedBoolNullableWithAggregatesFilter<$PrismaModel> | boolean | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedBoolNullableFilter<$PrismaModel>
    _max?: NestedBoolNullableFilter<$PrismaModel>
  }

  export type NestedIntNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableWithAggregatesFilter<$PrismaModel> | number | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedFloatNullableFilter<$PrismaModel>
    _sum?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedIntNullableFilter<$PrismaModel>
    _max?: NestedIntNullableFilter<$PrismaModel>
  }
  export type NestedJsonNullableFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<Required<NestedJsonNullableFilterBase<$PrismaModel>>, Exclude<keyof Required<NestedJsonNullableFilterBase<$PrismaModel>>, 'path'>>,
        Required<NestedJsonNullableFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<NestedJsonNullableFilterBase<$PrismaModel>>, 'path'>>

  export type NestedJsonNullableFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
  }

  export type TradeLogCreateWithoutUserInput = {
    id?: string
    pair?: string | null
    timeframe?: string | null
    session?: string | null
    action?: string | null
    pnl?: number | null
    notes?: string | null
    leverage?: number | null
    entry?: number | null
    stop?: number | null
    tp1?: number | null
    tp2?: number | null
    rr1?: number | null
    rr2?: number | null
    directionBias?: string | null
    eventType?: string | null
    sweepType?: string | null
    emaContext?: string | null
    reclaimConfirmed?: boolean | null
    planFollowed?: string | null
    ruleBreak?: string | null
    executionType?: string | null
    liquidityLevel?: string | null
    htfBias?: string | null
    entryTrigger?: string | null
    outcome?: string | null
    confidenceSelf?: number | null
    durationMinutes?: number | null
    emotionalPressure?: number | null
    setupQuality?: number | null
    disciplineScore?: number | null
    linkedEventId?: string | null
    screenshotUrl?: string | null
    aiScore?: number | null
    aiGrade?: string | null
    aiSummary?: string | null
    aiCoachingNote?: string | null
    aiStatus?: string | null
    setupScore?: number | null
    executionScore?: number | null
    managementScore?: number | null
    disciplineScoreAi?: number | null
    aiConfidence?: number | null
    chartRead?: string | null
    setupAssessment?: string | null
    executionAssessment?: string | null
    riskAssessment?: string | null
    biasAlignment?: string | null
    mistakeTags?: NullableJsonNullValueInput | InputJsonValue
    whatWasGood?: NullableJsonNullValueInput | InputJsonValue
    whatNeedsWork?: NullableJsonNullValueInput | InputJsonValue
    usedScreenshot?: boolean | null
    aiPayload?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type TradeLogUncheckedCreateWithoutUserInput = {
    id?: string
    pair?: string | null
    timeframe?: string | null
    session?: string | null
    action?: string | null
    pnl?: number | null
    notes?: string | null
    leverage?: number | null
    entry?: number | null
    stop?: number | null
    tp1?: number | null
    tp2?: number | null
    rr1?: number | null
    rr2?: number | null
    directionBias?: string | null
    eventType?: string | null
    sweepType?: string | null
    emaContext?: string | null
    reclaimConfirmed?: boolean | null
    planFollowed?: string | null
    ruleBreak?: string | null
    executionType?: string | null
    liquidityLevel?: string | null
    htfBias?: string | null
    entryTrigger?: string | null
    outcome?: string | null
    confidenceSelf?: number | null
    durationMinutes?: number | null
    emotionalPressure?: number | null
    setupQuality?: number | null
    disciplineScore?: number | null
    linkedEventId?: string | null
    screenshotUrl?: string | null
    aiScore?: number | null
    aiGrade?: string | null
    aiSummary?: string | null
    aiCoachingNote?: string | null
    aiStatus?: string | null
    setupScore?: number | null
    executionScore?: number | null
    managementScore?: number | null
    disciplineScoreAi?: number | null
    aiConfidence?: number | null
    chartRead?: string | null
    setupAssessment?: string | null
    executionAssessment?: string | null
    riskAssessment?: string | null
    biasAlignment?: string | null
    mistakeTags?: NullableJsonNullValueInput | InputJsonValue
    whatWasGood?: NullableJsonNullValueInput | InputJsonValue
    whatNeedsWork?: NullableJsonNullValueInput | InputJsonValue
    usedScreenshot?: boolean | null
    aiPayload?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type TradeLogCreateOrConnectWithoutUserInput = {
    where: TradeLogWhereUniqueInput
    create: XOR<TradeLogCreateWithoutUserInput, TradeLogUncheckedCreateWithoutUserInput>
  }

  export type TradeLogCreateManyUserInputEnvelope = {
    data: TradeLogCreateManyUserInput | TradeLogCreateManyUserInput[]
    skipDuplicates?: boolean
  }

  export type TradeLogUpsertWithWhereUniqueWithoutUserInput = {
    where: TradeLogWhereUniqueInput
    update: XOR<TradeLogUpdateWithoutUserInput, TradeLogUncheckedUpdateWithoutUserInput>
    create: XOR<TradeLogCreateWithoutUserInput, TradeLogUncheckedCreateWithoutUserInput>
  }

  export type TradeLogUpdateWithWhereUniqueWithoutUserInput = {
    where: TradeLogWhereUniqueInput
    data: XOR<TradeLogUpdateWithoutUserInput, TradeLogUncheckedUpdateWithoutUserInput>
  }

  export type TradeLogUpdateManyWithWhereWithoutUserInput = {
    where: TradeLogScalarWhereInput
    data: XOR<TradeLogUpdateManyMutationInput, TradeLogUncheckedUpdateManyWithoutUserInput>
  }

  export type TradeLogScalarWhereInput = {
    AND?: TradeLogScalarWhereInput | TradeLogScalarWhereInput[]
    OR?: TradeLogScalarWhereInput[]
    NOT?: TradeLogScalarWhereInput | TradeLogScalarWhereInput[]
    id?: StringFilter<"TradeLog"> | string
    userId?: StringFilter<"TradeLog"> | string
    pair?: StringNullableFilter<"TradeLog"> | string | null
    timeframe?: StringNullableFilter<"TradeLog"> | string | null
    session?: StringNullableFilter<"TradeLog"> | string | null
    action?: StringNullableFilter<"TradeLog"> | string | null
    pnl?: FloatNullableFilter<"TradeLog"> | number | null
    notes?: StringNullableFilter<"TradeLog"> | string | null
    leverage?: FloatNullableFilter<"TradeLog"> | number | null
    entry?: FloatNullableFilter<"TradeLog"> | number | null
    stop?: FloatNullableFilter<"TradeLog"> | number | null
    tp1?: FloatNullableFilter<"TradeLog"> | number | null
    tp2?: FloatNullableFilter<"TradeLog"> | number | null
    rr1?: FloatNullableFilter<"TradeLog"> | number | null
    rr2?: FloatNullableFilter<"TradeLog"> | number | null
    directionBias?: StringNullableFilter<"TradeLog"> | string | null
    eventType?: StringNullableFilter<"TradeLog"> | string | null
    sweepType?: StringNullableFilter<"TradeLog"> | string | null
    emaContext?: StringNullableFilter<"TradeLog"> | string | null
    reclaimConfirmed?: BoolNullableFilter<"TradeLog"> | boolean | null
    planFollowed?: StringNullableFilter<"TradeLog"> | string | null
    ruleBreak?: StringNullableFilter<"TradeLog"> | string | null
    executionType?: StringNullableFilter<"TradeLog"> | string | null
    liquidityLevel?: StringNullableFilter<"TradeLog"> | string | null
    htfBias?: StringNullableFilter<"TradeLog"> | string | null
    entryTrigger?: StringNullableFilter<"TradeLog"> | string | null
    outcome?: StringNullableFilter<"TradeLog"> | string | null
    confidenceSelf?: FloatNullableFilter<"TradeLog"> | number | null
    durationMinutes?: FloatNullableFilter<"TradeLog"> | number | null
    emotionalPressure?: FloatNullableFilter<"TradeLog"> | number | null
    setupQuality?: FloatNullableFilter<"TradeLog"> | number | null
    disciplineScore?: FloatNullableFilter<"TradeLog"> | number | null
    linkedEventId?: StringNullableFilter<"TradeLog"> | string | null
    screenshotUrl?: StringNullableFilter<"TradeLog"> | string | null
    aiScore?: IntNullableFilter<"TradeLog"> | number | null
    aiGrade?: StringNullableFilter<"TradeLog"> | string | null
    aiSummary?: StringNullableFilter<"TradeLog"> | string | null
    aiCoachingNote?: StringNullableFilter<"TradeLog"> | string | null
    aiStatus?: StringNullableFilter<"TradeLog"> | string | null
    setupScore?: IntNullableFilter<"TradeLog"> | number | null
    executionScore?: IntNullableFilter<"TradeLog"> | number | null
    managementScore?: IntNullableFilter<"TradeLog"> | number | null
    disciplineScoreAi?: IntNullableFilter<"TradeLog"> | number | null
    aiConfidence?: FloatNullableFilter<"TradeLog"> | number | null
    chartRead?: StringNullableFilter<"TradeLog"> | string | null
    setupAssessment?: StringNullableFilter<"TradeLog"> | string | null
    executionAssessment?: StringNullableFilter<"TradeLog"> | string | null
    riskAssessment?: StringNullableFilter<"TradeLog"> | string | null
    biasAlignment?: StringNullableFilter<"TradeLog"> | string | null
    mistakeTags?: JsonNullableFilter<"TradeLog">
    whatWasGood?: JsonNullableFilter<"TradeLog">
    whatNeedsWork?: JsonNullableFilter<"TradeLog">
    usedScreenshot?: BoolNullableFilter<"TradeLog"> | boolean | null
    aiPayload?: JsonNullableFilter<"TradeLog">
    createdAt?: DateTimeFilter<"TradeLog"> | Date | string
    updatedAt?: DateTimeFilter<"TradeLog"> | Date | string
  }

  export type UserCreateWithoutLogsInput = {
    id?: string
    email: string
    passwordHash: string
    createdAt?: Date | string
    updatedAt?: Date | string
    stripeCustomerId?: string | null
    stripeSubId?: string | null
    stripePriceId?: string | null
    billingStatus?: string | null
    billingPlan?: string | null
    billingPeriodEnd?: Date | string | null
    isActive?: boolean
  }

  export type UserUncheckedCreateWithoutLogsInput = {
    id?: string
    email: string
    passwordHash: string
    createdAt?: Date | string
    updatedAt?: Date | string
    stripeCustomerId?: string | null
    stripeSubId?: string | null
    stripePriceId?: string | null
    billingStatus?: string | null
    billingPlan?: string | null
    billingPeriodEnd?: Date | string | null
    isActive?: boolean
  }

  export type UserCreateOrConnectWithoutLogsInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutLogsInput, UserUncheckedCreateWithoutLogsInput>
  }

  export type UserUpsertWithoutLogsInput = {
    update: XOR<UserUpdateWithoutLogsInput, UserUncheckedUpdateWithoutLogsInput>
    create: XOR<UserCreateWithoutLogsInput, UserUncheckedCreateWithoutLogsInput>
    where?: UserWhereInput
  }

  export type UserUpdateToOneWithWhereWithoutLogsInput = {
    where?: UserWhereInput
    data: XOR<UserUpdateWithoutLogsInput, UserUncheckedUpdateWithoutLogsInput>
  }

  export type UserUpdateWithoutLogsInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    passwordHash?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    stripeCustomerId?: NullableStringFieldUpdateOperationsInput | string | null
    stripeSubId?: NullableStringFieldUpdateOperationsInput | string | null
    stripePriceId?: NullableStringFieldUpdateOperationsInput | string | null
    billingStatus?: NullableStringFieldUpdateOperationsInput | string | null
    billingPlan?: NullableStringFieldUpdateOperationsInput | string | null
    billingPeriodEnd?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
  }

  export type UserUncheckedUpdateWithoutLogsInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    passwordHash?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    stripeCustomerId?: NullableStringFieldUpdateOperationsInput | string | null
    stripeSubId?: NullableStringFieldUpdateOperationsInput | string | null
    stripePriceId?: NullableStringFieldUpdateOperationsInput | string | null
    billingStatus?: NullableStringFieldUpdateOperationsInput | string | null
    billingPlan?: NullableStringFieldUpdateOperationsInput | string | null
    billingPeriodEnd?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
  }

  export type TradeLogCreateManyUserInput = {
    id?: string
    pair?: string | null
    timeframe?: string | null
    session?: string | null
    action?: string | null
    pnl?: number | null
    notes?: string | null
    leverage?: number | null
    entry?: number | null
    stop?: number | null
    tp1?: number | null
    tp2?: number | null
    rr1?: number | null
    rr2?: number | null
    directionBias?: string | null
    eventType?: string | null
    sweepType?: string | null
    emaContext?: string | null
    reclaimConfirmed?: boolean | null
    planFollowed?: string | null
    ruleBreak?: string | null
    executionType?: string | null
    liquidityLevel?: string | null
    htfBias?: string | null
    entryTrigger?: string | null
    outcome?: string | null
    confidenceSelf?: number | null
    durationMinutes?: number | null
    emotionalPressure?: number | null
    setupQuality?: number | null
    disciplineScore?: number | null
    linkedEventId?: string | null
    screenshotUrl?: string | null
    aiScore?: number | null
    aiGrade?: string | null
    aiSummary?: string | null
    aiCoachingNote?: string | null
    aiStatus?: string | null
    setupScore?: number | null
    executionScore?: number | null
    managementScore?: number | null
    disciplineScoreAi?: number | null
    aiConfidence?: number | null
    chartRead?: string | null
    setupAssessment?: string | null
    executionAssessment?: string | null
    riskAssessment?: string | null
    biasAlignment?: string | null
    mistakeTags?: NullableJsonNullValueInput | InputJsonValue
    whatWasGood?: NullableJsonNullValueInput | InputJsonValue
    whatNeedsWork?: NullableJsonNullValueInput | InputJsonValue
    usedScreenshot?: boolean | null
    aiPayload?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type TradeLogUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    pair?: NullableStringFieldUpdateOperationsInput | string | null
    timeframe?: NullableStringFieldUpdateOperationsInput | string | null
    session?: NullableStringFieldUpdateOperationsInput | string | null
    action?: NullableStringFieldUpdateOperationsInput | string | null
    pnl?: NullableFloatFieldUpdateOperationsInput | number | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    leverage?: NullableFloatFieldUpdateOperationsInput | number | null
    entry?: NullableFloatFieldUpdateOperationsInput | number | null
    stop?: NullableFloatFieldUpdateOperationsInput | number | null
    tp1?: NullableFloatFieldUpdateOperationsInput | number | null
    tp2?: NullableFloatFieldUpdateOperationsInput | number | null
    rr1?: NullableFloatFieldUpdateOperationsInput | number | null
    rr2?: NullableFloatFieldUpdateOperationsInput | number | null
    directionBias?: NullableStringFieldUpdateOperationsInput | string | null
    eventType?: NullableStringFieldUpdateOperationsInput | string | null
    sweepType?: NullableStringFieldUpdateOperationsInput | string | null
    emaContext?: NullableStringFieldUpdateOperationsInput | string | null
    reclaimConfirmed?: NullableBoolFieldUpdateOperationsInput | boolean | null
    planFollowed?: NullableStringFieldUpdateOperationsInput | string | null
    ruleBreak?: NullableStringFieldUpdateOperationsInput | string | null
    executionType?: NullableStringFieldUpdateOperationsInput | string | null
    liquidityLevel?: NullableStringFieldUpdateOperationsInput | string | null
    htfBias?: NullableStringFieldUpdateOperationsInput | string | null
    entryTrigger?: NullableStringFieldUpdateOperationsInput | string | null
    outcome?: NullableStringFieldUpdateOperationsInput | string | null
    confidenceSelf?: NullableFloatFieldUpdateOperationsInput | number | null
    durationMinutes?: NullableFloatFieldUpdateOperationsInput | number | null
    emotionalPressure?: NullableFloatFieldUpdateOperationsInput | number | null
    setupQuality?: NullableFloatFieldUpdateOperationsInput | number | null
    disciplineScore?: NullableFloatFieldUpdateOperationsInput | number | null
    linkedEventId?: NullableStringFieldUpdateOperationsInput | string | null
    screenshotUrl?: NullableStringFieldUpdateOperationsInput | string | null
    aiScore?: NullableIntFieldUpdateOperationsInput | number | null
    aiGrade?: NullableStringFieldUpdateOperationsInput | string | null
    aiSummary?: NullableStringFieldUpdateOperationsInput | string | null
    aiCoachingNote?: NullableStringFieldUpdateOperationsInput | string | null
    aiStatus?: NullableStringFieldUpdateOperationsInput | string | null
    setupScore?: NullableIntFieldUpdateOperationsInput | number | null
    executionScore?: NullableIntFieldUpdateOperationsInput | number | null
    managementScore?: NullableIntFieldUpdateOperationsInput | number | null
    disciplineScoreAi?: NullableIntFieldUpdateOperationsInput | number | null
    aiConfidence?: NullableFloatFieldUpdateOperationsInput | number | null
    chartRead?: NullableStringFieldUpdateOperationsInput | string | null
    setupAssessment?: NullableStringFieldUpdateOperationsInput | string | null
    executionAssessment?: NullableStringFieldUpdateOperationsInput | string | null
    riskAssessment?: NullableStringFieldUpdateOperationsInput | string | null
    biasAlignment?: NullableStringFieldUpdateOperationsInput | string | null
    mistakeTags?: NullableJsonNullValueInput | InputJsonValue
    whatWasGood?: NullableJsonNullValueInput | InputJsonValue
    whatNeedsWork?: NullableJsonNullValueInput | InputJsonValue
    usedScreenshot?: NullableBoolFieldUpdateOperationsInput | boolean | null
    aiPayload?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TradeLogUncheckedUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    pair?: NullableStringFieldUpdateOperationsInput | string | null
    timeframe?: NullableStringFieldUpdateOperationsInput | string | null
    session?: NullableStringFieldUpdateOperationsInput | string | null
    action?: NullableStringFieldUpdateOperationsInput | string | null
    pnl?: NullableFloatFieldUpdateOperationsInput | number | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    leverage?: NullableFloatFieldUpdateOperationsInput | number | null
    entry?: NullableFloatFieldUpdateOperationsInput | number | null
    stop?: NullableFloatFieldUpdateOperationsInput | number | null
    tp1?: NullableFloatFieldUpdateOperationsInput | number | null
    tp2?: NullableFloatFieldUpdateOperationsInput | number | null
    rr1?: NullableFloatFieldUpdateOperationsInput | number | null
    rr2?: NullableFloatFieldUpdateOperationsInput | number | null
    directionBias?: NullableStringFieldUpdateOperationsInput | string | null
    eventType?: NullableStringFieldUpdateOperationsInput | string | null
    sweepType?: NullableStringFieldUpdateOperationsInput | string | null
    emaContext?: NullableStringFieldUpdateOperationsInput | string | null
    reclaimConfirmed?: NullableBoolFieldUpdateOperationsInput | boolean | null
    planFollowed?: NullableStringFieldUpdateOperationsInput | string | null
    ruleBreak?: NullableStringFieldUpdateOperationsInput | string | null
    executionType?: NullableStringFieldUpdateOperationsInput | string | null
    liquidityLevel?: NullableStringFieldUpdateOperationsInput | string | null
    htfBias?: NullableStringFieldUpdateOperationsInput | string | null
    entryTrigger?: NullableStringFieldUpdateOperationsInput | string | null
    outcome?: NullableStringFieldUpdateOperationsInput | string | null
    confidenceSelf?: NullableFloatFieldUpdateOperationsInput | number | null
    durationMinutes?: NullableFloatFieldUpdateOperationsInput | number | null
    emotionalPressure?: NullableFloatFieldUpdateOperationsInput | number | null
    setupQuality?: NullableFloatFieldUpdateOperationsInput | number | null
    disciplineScore?: NullableFloatFieldUpdateOperationsInput | number | null
    linkedEventId?: NullableStringFieldUpdateOperationsInput | string | null
    screenshotUrl?: NullableStringFieldUpdateOperationsInput | string | null
    aiScore?: NullableIntFieldUpdateOperationsInput | number | null
    aiGrade?: NullableStringFieldUpdateOperationsInput | string | null
    aiSummary?: NullableStringFieldUpdateOperationsInput | string | null
    aiCoachingNote?: NullableStringFieldUpdateOperationsInput | string | null
    aiStatus?: NullableStringFieldUpdateOperationsInput | string | null
    setupScore?: NullableIntFieldUpdateOperationsInput | number | null
    executionScore?: NullableIntFieldUpdateOperationsInput | number | null
    managementScore?: NullableIntFieldUpdateOperationsInput | number | null
    disciplineScoreAi?: NullableIntFieldUpdateOperationsInput | number | null
    aiConfidence?: NullableFloatFieldUpdateOperationsInput | number | null
    chartRead?: NullableStringFieldUpdateOperationsInput | string | null
    setupAssessment?: NullableStringFieldUpdateOperationsInput | string | null
    executionAssessment?: NullableStringFieldUpdateOperationsInput | string | null
    riskAssessment?: NullableStringFieldUpdateOperationsInput | string | null
    biasAlignment?: NullableStringFieldUpdateOperationsInput | string | null
    mistakeTags?: NullableJsonNullValueInput | InputJsonValue
    whatWasGood?: NullableJsonNullValueInput | InputJsonValue
    whatNeedsWork?: NullableJsonNullValueInput | InputJsonValue
    usedScreenshot?: NullableBoolFieldUpdateOperationsInput | boolean | null
    aiPayload?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TradeLogUncheckedUpdateManyWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    pair?: NullableStringFieldUpdateOperationsInput | string | null
    timeframe?: NullableStringFieldUpdateOperationsInput | string | null
    session?: NullableStringFieldUpdateOperationsInput | string | null
    action?: NullableStringFieldUpdateOperationsInput | string | null
    pnl?: NullableFloatFieldUpdateOperationsInput | number | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    leverage?: NullableFloatFieldUpdateOperationsInput | number | null
    entry?: NullableFloatFieldUpdateOperationsInput | number | null
    stop?: NullableFloatFieldUpdateOperationsInput | number | null
    tp1?: NullableFloatFieldUpdateOperationsInput | number | null
    tp2?: NullableFloatFieldUpdateOperationsInput | number | null
    rr1?: NullableFloatFieldUpdateOperationsInput | number | null
    rr2?: NullableFloatFieldUpdateOperationsInput | number | null
    directionBias?: NullableStringFieldUpdateOperationsInput | string | null
    eventType?: NullableStringFieldUpdateOperationsInput | string | null
    sweepType?: NullableStringFieldUpdateOperationsInput | string | null
    emaContext?: NullableStringFieldUpdateOperationsInput | string | null
    reclaimConfirmed?: NullableBoolFieldUpdateOperationsInput | boolean | null
    planFollowed?: NullableStringFieldUpdateOperationsInput | string | null
    ruleBreak?: NullableStringFieldUpdateOperationsInput | string | null
    executionType?: NullableStringFieldUpdateOperationsInput | string | null
    liquidityLevel?: NullableStringFieldUpdateOperationsInput | string | null
    htfBias?: NullableStringFieldUpdateOperationsInput | string | null
    entryTrigger?: NullableStringFieldUpdateOperationsInput | string | null
    outcome?: NullableStringFieldUpdateOperationsInput | string | null
    confidenceSelf?: NullableFloatFieldUpdateOperationsInput | number | null
    durationMinutes?: NullableFloatFieldUpdateOperationsInput | number | null
    emotionalPressure?: NullableFloatFieldUpdateOperationsInput | number | null
    setupQuality?: NullableFloatFieldUpdateOperationsInput | number | null
    disciplineScore?: NullableFloatFieldUpdateOperationsInput | number | null
    linkedEventId?: NullableStringFieldUpdateOperationsInput | string | null
    screenshotUrl?: NullableStringFieldUpdateOperationsInput | string | null
    aiScore?: NullableIntFieldUpdateOperationsInput | number | null
    aiGrade?: NullableStringFieldUpdateOperationsInput | string | null
    aiSummary?: NullableStringFieldUpdateOperationsInput | string | null
    aiCoachingNote?: NullableStringFieldUpdateOperationsInput | string | null
    aiStatus?: NullableStringFieldUpdateOperationsInput | string | null
    setupScore?: NullableIntFieldUpdateOperationsInput | number | null
    executionScore?: NullableIntFieldUpdateOperationsInput | number | null
    managementScore?: NullableIntFieldUpdateOperationsInput | number | null
    disciplineScoreAi?: NullableIntFieldUpdateOperationsInput | number | null
    aiConfidence?: NullableFloatFieldUpdateOperationsInput | number | null
    chartRead?: NullableStringFieldUpdateOperationsInput | string | null
    setupAssessment?: NullableStringFieldUpdateOperationsInput | string | null
    executionAssessment?: NullableStringFieldUpdateOperationsInput | string | null
    riskAssessment?: NullableStringFieldUpdateOperationsInput | string | null
    biasAlignment?: NullableStringFieldUpdateOperationsInput | string | null
    mistakeTags?: NullableJsonNullValueInput | InputJsonValue
    whatWasGood?: NullableJsonNullValueInput | InputJsonValue
    whatNeedsWork?: NullableJsonNullValueInput | InputJsonValue
    usedScreenshot?: NullableBoolFieldUpdateOperationsInput | boolean | null
    aiPayload?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }



  /**
   * Batch Payload for updateMany & deleteMany & createMany
   */

  export type BatchPayload = {
    count: number
  }

  /**
   * DMMF
   */
  export const dmmf: runtime.BaseDMMF
}