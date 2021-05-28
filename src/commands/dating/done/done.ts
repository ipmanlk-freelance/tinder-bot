import { Message, MessageReaction, User } from "discord.js";
import {
	clearPendingMatch,
	deleteMatch,
	getMatch,
	getPendingMatch,
} from "../../../data";
import { getBotConfig } from "../../../util/config";
import { parseYAML } from "../../../util/parse";

const botConfig: any = getBotConfig();
const cmdConfig: any = parseYAML(`${__dirname}/done.yaml`);

export const handle = async (msg: Message) => {
	if (msg.channel.type != "text") {
		return;
	}

	if (msg.channel.parentID != cmdConfig["DATING CATEGORY"]) {
		return;
	}

	const guild = msg.guild;
	const matchChannel = msg.channel;

	msg.delete({ timeout: 5000 });

	// check if this is a pending channel
	const pendingRes = await getPendingMatch(msg.author.id);

	if (pendingRes.isErr()) {
		console.log(pendingRes.error);
		console.log("Unable to access the database.");
		return;
	}

	if (pendingRes.value) {
		msg.channel.send(`<@${msg.author.id}>,`, {
			embed: {
				title: "Channel is closing",
				color: 0xff007f,
				thumbnail: {
					url: "https://media2.giphy.com/media/l2ZDYicAc3XXjkpWw/giphy.gif",
				},
				description: `Please be patient. I will close this channel in few moments.`,
			},
		});

		const clearRes = await clearPendingMatch(msg.author.id);

		if (clearRes.isErr()) {
			console.log(clearRes.error);
			return;
		}

		setTimeout(() => {
			msg.channel.delete();
		}, 10000);
		return;
	}

	// get dating channel info
	const res = await getMatch(msg.channel.id);

	if (res.isErr()) {
		console.log("Unable to access the database.");
		return;
	}

	const record = res.value;

	const authorMember = await guild?.members.fetch(record.authorId);
	const matchMember = await guild?.members.fetch(record.matchId);

	if (!authorMember) {
		console.log("Unable to find the author");
		return;
	}

	if (!matchMember) {
		console.log("Unable to find the matched member");
		return;
	}

	const doneConfirmation = await matchChannel.send(
		`<@${authorMember.id}> <@${matchMember.id}>,`,
		{
			embed: {
				title: "Private channel is about to close.",
				color: 0xff007f,
				description: `**You won't be able to access or recover this chat after the confirmation.**`,
				footer: {
					text: `Please react with 👍 to accept or 👎 to confirm.`,
				},
			},
		}
	);

	await doneConfirmation.react("👍");
	await doneConfirmation.react("👎");

	let collected;
	try {
		const filter = (reaction: MessageReaction, user: User) => {
			return (
				["👍", "👎"].includes(reaction.emoji.name) &&
				[authorMember.id, matchMember.id].includes(user.id)
			);
		};

		collected = await doneConfirmation.awaitReactions(filter, {
			max: 2,
			time: 60000,
			errors: ["time"],
		});
	} catch (e) {
		matchChannel.send({
			embed: {
				color: 0xff0000,
				description:
					"Channel closing failed because a parties failed to respond.",
			},
		});
		return;
	}

	let authorConfirmed = false;
	let matchConfirmed = false;

	collected.forEach((r) => {
		if (!authorConfirmed) {
			authorConfirmed = r.users.cache.get(authorMember.id) != undefined;
		}
		if (!matchConfirmed) {
			matchConfirmed = r.users.cache.get(matchMember.id) != undefined;
		}
	});

	if (authorConfirmed && matchConfirmed == false) {
		matchChannel.send({
			embed: {
				color: 0xff0000,
				description:
					"Channel closing failed because a parties failed to respond.",
			},
		});
		return;
	}

	const deleteRes = await deleteMatch(matchChannel.id);

	if (deleteRes.isErr()) {
		matchChannel.send({
			embed: {
				color: 0xff0000,
				description: "Unable to close this private channel.",
			},
		});
		return;
	}

	await matchChannel.send({
		embed: {
			color: 0x2d91e7,
			description:
				"**Closing has been confirmed. This private channel will close in few moments.**",
		},
	});

	setTimeout(() => {
		matchChannel.delete().catch((e) => console.log(e));
	}, 10000);

	sendDualResponse(
		authorMember.user,
		matchMember.user,
		`Your private chat with **${
			matchMember.nickname || matchMember.user.username
		}** has been closed.`,
		`Your private chat with **${
			authorMember.nickname || authorMember.user.username
		}** has been closed.`
	);
};

const sendDualResponse = (
	author: User,
	match: User,
	authorMsg: string,
	matchMsg: string
) => {
	author.send({
		embed: {
			color: 0x2d91e7,
			description: authorMsg,
		},
	});
	match.send({
		embed: {
			color: 0x2d91e7,
			description: matchMsg,
		},
	});
};
