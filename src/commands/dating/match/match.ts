import {
	CategoryChannel,
	Guild,
	GuildMember,
	Message,
	MessageReaction,
	TextChannel,
	User,
} from "discord.js";
import { getMatches, saveMatch } from "../../../data";
import { getBotConfig, getReactionRoleConfig } from "../../../util/config";
import { parseYAML } from "../../../util/parse";

const botConfig: any = getBotConfig();
const cmdConfig: any = parseYAML(`${__dirname}/match.yaml`);
const reactionRoleConfig: any = getReactionRoleConfig();

interface UserInfo {
	user: User;
	age: number;
	location: string;
}

export const handle = async (msg: Message) => {
	if (cmdConfig["MATCH CHANNEL"] !== msg.channel.id) {
		return;
	}

	const guild = msg.guild;
	const author = msg.author;
	const authorMember = msg.member;
	const matchMember = msg.mentions.members?.first();

	if (!guild || !authorMember) return;

	if (!matchMember) {
		sendErrorDM(author, "Please mention a member to match.");
		deleteMsgIfPossible(msg);
		return;
	}

	if (matchMember.id == author.id) {
		sendErrorDM(author, "You can't match yourself.");
		deleteMsgIfPossible(msg);
		return;
	}

	// check if these two already have a match open
	const matches = await getMatches(author.id, matchMember.id);

	if (matches.isErr()) {
		console.log("Unable to access the database.");
		deleteMsgIfPossible(msg);
		return;
	}

	if (matches.value.length != 0) {
		deleteMsgIfPossible(msg);
		sendErrorDM(
			author,
			`You already have a private chat open with **${
				matchMember.nickname || matchMember.user.username
			}**.`
		);

		const dChannel = guild.channels.cache.get(matches.value[0].channelId);

		if (!dChannel) return;

		const datingChannel = dChannel as TextChannel;

		datingChannel.send(
			`**<@${author.id}> <@${matchMember.id}>, Please close this private chat first with _${botConfig.PREFIX}done_ command before opening an another.**`
		);

		return;
	}

	// figure out gender of both author and match
	const authorGender = getGender(authorMember);
	const matchGender = getGender(matchMember);

	if (authorGender.trim() == "") {
		sendErrorDM(author, "Please add a gender role before starting a match.");
		deleteMsgIfPossible(msg);
		return;
	}

	if (matchGender.trim() == "") {
		sendErrorDM(
			author,
			`Your match **${
				matchMember.nickname || matchMember.user.username
			}** doesn't have a gender role. Please ask that person to add one first.`
		);
		deleteMsgIfPossible(msg);
		return;
	}

	deleteMsgIfPossible(msg);

	// start getting author information
	let authorAge, authorLocation;

	try {
		authorAge = await getAge(author);
	} catch (e) {
		sendErrorDM(
			author,
			"You failed to provide your age. Please start a match again."
		);
		return;
	}

	await sendSuccessDM(author, `**Your age is: ${authorAge}**`);

	try {
		authorLocation = await getLocation(author);
	} catch (e) {
		sendErrorDM(
			author,
			"You failed to provide your location. Please start a match again."
		);
		return;
	}

	await sendSuccessDM(author, `**Your location is: ${authorLocation}**`);

	await sendSuccessDM(author, `Please be patient until your match responds.`);

	// invite to the matched user
	const inviteMsg = await matchMember.send({
		embed: {
			color: 0xff007f,
			description: `Member **${
				msg.member?.nickname || msg.member?.user.username
			}** would like to start a private conversation with you.\n\nMember Formation,`,
			fields: [
				{ name: "Gender", value: authorGender },
				{ name: "Age", value: authorAge },
				{ name: "Location", value: authorLocation },
			],
		},
		footer: {
			text: "Please react with 👍 to accept or 👎 to reject.",
		},
	});

	await inviteMsg.react("👍");
	await inviteMsg.react("👎");

	const filter = (reaction: MessageReaction, user: User) => {
		return (
			["👍", "👎"].includes(reaction.emoji.name) &&
			user.id === matchMember.user.id
		);
	};

	let collected;

	try {
		collected = await inviteMsg.awaitReactions(filter, {
			max: 1,
			time: 60000,
			errors: ["time"],
		});
	} catch (e) {
		sendDualResponse(
			author,
			matchMember.user,
			`**${
				matchMember.nickname || matchMember.user.username
			}** failed to reply to your invitation.`,
			`You failed to respond to the invitation from **${
				msg.member?.nickname || author.username
			}**.`
		);
		return;
	}

	const reaction = collected.first();

	if (!reaction) return;

	if (reaction.emoji.name === "👍") {
		// get match age and location
		let matchAge, matchLocation;

		try {
			matchAge = await getAge(matchMember.user);
		} catch (e) {
			await sendErrorDM(matchMember.user, "You failed to provide your age.");
		}

		await sendSuccessDM(matchMember.user, `**Your age is: ${matchAge}**`);

		try {
			matchLocation = await getLocation(matchMember.user);
		} catch (e) {
			await sendErrorDM(
				matchMember.user,
				"You failed to provide your location."
			);
		}

		await sendSuccessDM(
			matchMember.user,
			`**Your location is: ${matchLocation}**`
		);

		if (!matchAge || !matchLocation) {
			sendDualResponse(
				author,
				matchMember.user,
				`**${
					matchMember.nickname || matchMember.user.username
				}** failed to reply to your invitation.`,
				`You failed to respond to the invitation from **${
					msg.member?.nickname || author.username
				}**.`
			);
			return;
		}

		await sendSuccessDM(
			matchMember.user,
			`Please be patient until ${
				msg.member?.nickname || author.username
			} confirms this request.`
		);

		// get author confirmation
		const confirmation = await getAuthorConfirmation(
			author,
			`${matchMember.nickname || matchMember.user.username}`,
			matchGender,
			matchAge,
			matchLocation
		);

		if (!confirmation) {
			sendDualResponse(
				author,
				matchMember.user,
				`You have cancelled the private chat invitation to **${
					matchMember.nickname || matchMember.user.username
				}**.`,
				`Member **${
					(msg.member?.nickname, author.username)
				}** cancelled the private chat invitation.`
			);
			return;
		}

		sendDualResponse(
			author,
			matchMember.user,
			`You have confirmed the private chat invitation to member **${
				matchMember.nickname || matchMember.user.username
			}**.`,
			`Member **${
				msg.member?.nickname || author.username
			}** has confirmed the private chat invitation.`
		);

		const authorInfo: UserInfo = {
			user: author,
			age: authorAge,
			location: authorLocation,
		};

		const matchInfo: UserInfo = {
			user: matchMember.user,
			age: matchAge,
			location: matchLocation,
		};

		createMatch(guild, authorInfo, matchInfo).catch((e) => {
			console.log(e);
		});
	} else {
		sendDualResponse(
			author,
			matchMember.user,
			`**${
				matchMember.nickname || matchMember.user.username
			}** rejected your private chat invitation.`,
			`You have rejected the private chat invitation from **${
				msg.member?.nickname || author.username
			}**.`
		);
	}
};

const getAge = async (user: User) => {
	let age: number = 0;

	while (age == 0) {
		const filter = (m: Message) => m.author.id == user.id;

		const dm = await user.send({
			embed: {
				color: 0x2d91e7,
				description: "Please provide your age: ",
				footer: {
					text: "Your age should be above 18",
				},
			},
		});

		const collected = await dm.channel.awaitMessages(filter, {
			max: 1,
			time: 300000,
		});

		if (collected.size == 0) {
			throw "No age provided.";
		}

		const collectedAge = collected.first()?.content;

		if (
			collectedAge &&
			!isNaN(parseInt(collectedAge)) &&
			parseInt(collectedAge) < 90 &&
			parseInt(collectedAge) >= 18
		) {
			age = parseInt(collectedAge);
		} else {
			user.send({
				embed: {
					color: 0xff0000,
					description: "Please provide a valid age.",
				},
			});
		}
	}

	return age;
};

const getLocation = async (user: User) => {
	let location: string = "";

	while (location == "") {
		const filter = (m: Message) => m.author.id == user.id;

		const dm = await user.send({
			embed: {
				color: 0x2d91e7,
				description: "Please provide your location: ",
			},
		});

		const collected = await dm.channel.awaitMessages(filter, {
			max: 1,
			time: 300000,
		});

		if (collected.size == 0) {
			throw "No location provided.";
		}

		const collectedLocation = collected.first()?.content;

		if (collectedLocation && collectedLocation.trim() != "") {
			location = collectedLocation.trim();
		} else {
			user.send({
				embed: {
					color: 0xff0000,
					description: "Please provide a valid location.",
				},
			});
		}
	}
	return location;
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

const sendSuccessDM = async (user: User, text: string) => {
	await user.send({
		embed: {
			color: 0x2d91e7,
			description: text,
		},
	});
};

const sendErrorDM = async (user: User, text: string) => {
	await user.send({
		embed: {
			color: 0xff0000,
			description: text,
		},
	});
};

const getAuthorConfirmation = async (
	author: User,
	matchName: string,
	matchGender: string,
	matchAge: number,
	matchLocation: string
) => {
	const dm = await author.send({
		embed: {
			color: 0xff007f,
			description: `Here are the information about **${matchName}**. Would you like to continue?.`,
			fields: [
				{ name: "Gender", value: matchGender },
				{ name: "Age", value: matchAge },
				{ name: "Location", value: matchLocation },
			],
		},
		footer: {
			text: "Please react with 👍 to accept or 👎 to reject.",
		},
	});

	await dm.react("👍");
	await dm.react("👎");

	const filter = (reaction: MessageReaction, user: User) => {
		return ["👍", "👎"].includes(reaction.emoji.name) && user.id === author.id;
	};

	let collected;

	try {
		collected = await dm.awaitReactions(filter, {
			max: 1,
			time: 60000,
			errors: ["time"],
		});
	} catch (e) {
		return false;
	}

	const reaction = collected.first();

	if (!reaction) return false;

	if (reaction.emoji.name === "👍") {
		return true;
	} else {
		return false;
	}
};

const deleteMsgIfPossible = (msg: Message) => {
	if (msg.channel.type != "dm") {
		msg.react("✅");
		msg.delete({ timeout: 5000 }).catch((e) => {});
	}
};

// create channel and assign permissions
const createMatch = async (
	guild: Guild,
	authorInfo: UserInfo,
	matchInfo: UserInfo
) => {
	// find category
	const category = guild.channels.cache.get(cmdConfig["DATING CATEGORY"]);

	if (!category || category.type != "category") {
		console.log(
			"Failed to locate the dating category channel. Please check your configuration."
		);
		return;
	}
	const categoryChannel = category as CategoryChannel;

	// create a new channel
	const channelName = `match-${categoryChannel.children.size + 1}`;

	const datingChannel = await guild.channels
		.create(channelName, {
			type: "text",
			permissionOverwrites: [
				{ id: guild.roles.everyone, deny: "VIEW_CHANNEL" },
				{ id: authorInfo.user, allow: "VIEW_CHANNEL" },
				{ id: matchInfo.user, allow: "VIEW_CHANNEL" },
			],
			parent: categoryChannel,
		})
		.catch((e) => {
			console.log(
				"Failed to create a dating channel. Please check your bot permissions and configuration."
			);
		});

	if (!datingChannel) return;

	const res = await saveMatch(
		datingChannel.id,
		authorInfo.user.id,
		matchInfo.user.id
	);

	if (res.isErr()) {
		console.log(res.error);
		return;
	}

	datingChannel.send(`<@${authorInfo.user.id}> <@${matchInfo.user.id}>,`, {
		embed: {
			title: "Private dating channel created.",
			color: 0xff007f,
			description: `**Participants,**
			<@${authorInfo.user.id}> | Age: ${authorInfo.age} | Location: ${authorInfo.location}
			<@${matchInfo.user.id}> | Age: ${matchInfo.age} | Location: ${matchInfo.location}`,
			footer: {
				text: `Please use ${botConfig.PREFIX}done command to close this private chat.`,
			},
		},
	});
};

const getGender = (member: GuildMember) => {
	const rolesNames = reactionRoleConfig["ROLE NAMES"];

	let roleName: string = "";
	Object.keys(rolesNames).every((roleId) => {
		if (member.roles.cache.get(roleId)) {
			roleName = rolesNames[roleId];
			return false;
		}
		return true;
	});

	return roleName;
};
