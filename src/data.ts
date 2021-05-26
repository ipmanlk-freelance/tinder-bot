import sqlite3 from "sqlite3";
import { open, Database } from "sqlite";
import { Result, ok, err } from "neverthrow";

let connection: any;

export interface DBError {
	code: "INTERNAL";
	error: any;
}

export const saveMatch = async (
	channelId: string,
	authorId: string,
	matchId: string
): Promise<Result<true, DBError>> => {
	const db = await getConnection();

	try {
		await db.run(
			"INSERT INTO matches(channelId, authorId, matchId) VALUES(?,?, ?)",
			[channelId, authorId, matchId]
		);

		return ok(true);
	} catch (e) {
		return err({
			code: "INTERNAL",
			error: e,
		});
	}
};

export const getMatches = async (
	memberId: string
): Promise<Result<Array<any>, DBError>> => {
	const db = await getConnection();

	const records = await db.all(
		"SELECT * FROM matches WHERE authorId = ? OR matchId = ?",
		[memberId, memberId]
	);

	try {
		return ok(records);
	} catch (e) {
		return err({
			code: "INTERNAL",
			error: e,
		});
	}
};

const getConnection = async () => {
	try {
		if (connection) {
			return connection as Database;
		}

		const db = await open({
			filename: `${__dirname}/../data/data.db`,
			driver: sqlite3.Database,
		});

		await db.run(
			"CREATE TABLE IF NOT EXISTS matches(channelId TEXT, authorId TEXT, matchId TEXT, PRIMARY KEY(channelId, authorId, matchId))"
		);

		connection = db;
		return db;
	} catch (e) {
		throw {
			code: "INTERNAL",
			error: e,
		} as DBError;
	}
};
