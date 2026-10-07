/* Better Auth tables (drizzle/0004_better_auth.sql). Prefixed `ba_` so they never collide with the
   legacy `users` / `sessions` tables, which stay in place for provenance. Keys are Better Auth's
   field names; columns are snake_case. */
import {sqliteTable,text,integer,index} from 'drizzle-orm/sqlite-core';

const ts=(name:string)=>integer(name,{mode:'timestamp_ms'});

export const user=sqliteTable('ba_user',{
 id:text('id').primaryKey(),
 name:text('name').notNull(),
 email:text('email').notNull().unique(),
 emailVerified:integer('email_verified',{mode:'boolean'}).notNull().default(false),
 image:text('image'),
 createdAt:ts('created_at').notNull(),
 updatedAt:ts('updated_at').notNull(),
});
export const session=sqliteTable('ba_session',{
 id:text('id').primaryKey(),
 expiresAt:ts('expires_at').notNull(),
 token:text('token').notNull().unique(),
 createdAt:ts('created_at').notNull(),
 updatedAt:ts('updated_at').notNull(),
 ipAddress:text('ip_address'),
 userAgent:text('user_agent'),
 userId:text('user_id').notNull(),
},t=>[index('ba_session_user').on(t.userId)]);
export const account=sqliteTable('ba_account',{
 id:text('id').primaryKey(),
 accountId:text('account_id').notNull(),
 providerId:text('provider_id').notNull(),
 userId:text('user_id').notNull(),
 accessToken:text('access_token'),
 refreshToken:text('refresh_token'),
 idToken:text('id_token'),
 accessTokenExpiresAt:ts('access_token_expires_at'),
 refreshTokenExpiresAt:ts('refresh_token_expires_at'),
 scope:text('scope'),
 password:text('password'),
 createdAt:ts('created_at').notNull(),
 updatedAt:ts('updated_at').notNull(),
},t=>[index('ba_account_user').on(t.userId)]);
export const verification=sqliteTable('ba_verification',{
 id:text('id').primaryKey(),
 identifier:text('identifier').notNull(),
 value:text('value').notNull(),
 expiresAt:ts('expires_at').notNull(),
 createdAt:ts('created_at'),
 updatedAt:ts('updated_at'),
},t=>[index('ba_verification_identifier').on(t.identifier)]);
export const walletAddress=sqliteTable('ba_wallet_address',{
 id:text('id').primaryKey(),
 userId:text('user_id').notNull(),
 address:text('address').notNull(),
 chainId:integer('chain_id').notNull(),
 isPrimary:integer('is_primary',{mode:'boolean'}).default(false),
 createdAt:ts('created_at').notNull(),
},t=>[index('ba_wallet_address_user').on(t.userId),index('ba_wallet_address_address').on(t.address)]);

export const authSchema={user,session,account,verification,walletAddress};
