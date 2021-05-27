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
	authorId: string,
	matchId: string
): Promise<Result<Array<any>, DBError>> => {
	const db = await getConnection();

	const records = await db.all(
		"SELECT * FROM matches WHERE authorId = ? AND matchId = ? OR matchId = ? AND authorId = ?",
		[authorId, matchId, authorId, matchId]
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

export const getMatch = async (channelId: string) => {
	const db = await getConnection();

	const record = await db.get("SELECT * FROM matches WHERE channelId = ?", [
		channelId,
	]);

	try {
		return ok(record);
	} catch (e) {
		return err({
			code: "INTERNAL",
			error: e,
		});
	}
};

export const deleteMatch = async (
	channelId: string
): Promise<Result<true, DBError>> => {
	const db = await getConnection();

	try {
		await db.run("DELETE FROM matches WHERE channelId = ?", [channelId]);
		return ok(true);
	} catch (e) {
		return err({
			code: "INTERNAL",
			error: e,
		});
	}
};

export const saveMemberInfo = async (
	memberId: string,
	age: number,
	location: string,
	favColor: string,
	favAnimal: string,
	height: string,
	happyReason: string
): Promise<Result<true, DBError>> => {
	const db = await getConnection();
	try {
		await db.run(
			"INSERT INTO member_info(memberId, age, location, fav_color, fav_animal, height, happy_reason) VALUES(?,?,?,?,?,?, ?)",
			[memberId, age, location, favColor, favAnimal, height, happyReason]
		);

		return ok(true);
	} catch (e) {
		return err({
			code: "INTERNAL",
			error: e,
		});
	}
};

export const getMemberInfo = async (memberId: string) => {
	const db = await getConnection();

	const record = await db.get("SELECT * FROM member_info WHERE memberId = ?", [
		memberId,
	]);

	try {
		return ok(record);
	} catch (e) {
		return err({
			code: "INTERNAL",
			error: e,
		});
	}
};

export const getPendingMatch = async (memberId: string) => {
	const db = await getConnection();

	const record = await db.get(
		"SELECT * FROM pending_matches WHERE memberId = ?",
		[memberId]
	);

	try {
		return ok(record);
	} catch (e) {
		return err({
			code: "INTERNAL",
			error: e,
		});
	}
};

export const savePendingMatch = async (
	memberId: string,
	channelId: string
): Promise<Result<true, DBError>> => {
	const db = await getConnection();

	try {
		await db.run(
			"INSERT INTO pending_matches(memberId, channelId) VALUES(?,?)",
			[memberId, channelId]
		);

		return ok(true);
	} catch (e) {
		return err({
			code: "INTERNAL",
			error: e,
		});
	}
};

export const clearPendingMatch = async (
	memberId: string
): Promise<Result<true, DBError>> => {
	const db = await getConnection();

	try {
		await db.run("DELETE FROM pending_matches WHERE memberId = ?", [memberId]);
		return ok(true);
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
		await db.run(
			"CREATE TABLE IF NOT EXISTS member_info(memberId TEXT, age INTEGER, location TEXT, fav_color TEXT, fav_animal TEXT, height TEXT, happy_reason TEXT, PRIMARY KEY(memberId))"
		);
		await db.run(
			"CREATE TABLE IF NOT EXISTS pending_matches(memberId TEXT, channelId TEXT, PRIMARY KEY(memberId, channelId))"
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
