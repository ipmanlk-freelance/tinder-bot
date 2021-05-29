import {
	CategoryChannel,
	Guild,
	GuildMember,
	Message,
	MessageReaction,
	TextChannel,
	User,
} from "discord.js";
import {
	clearPendingMatch,
	getMatches,
	getMemberInfo,
	saveMatch,
} from "../../../data";
import { getBotConfig, getReactionRoleConfig } from "../../../util/config";
import { parseYAML } from "../../../util/parse";

const botConfig: any = getBotConfig();
const cmdConfig: any = parseYAML(`${__dirname}/match.yaml`);
const reactionRoleConfig: any = getReactionRoleConfig();

export const handle = async (msg: Message) => {
	const clientUser = msg.client.user;
	const msgChannel = msg.channel;
	const guild = msg.guild;
	const author = msg.author;
	const authorMember = msg.member;
	const matchMember = msg.mentions.members?.first();

	if (!guild || !authorMember || msgChannel.type != "text" || !clientUser)
		return;

	if (!matchMember) {
		sendErrorReply(msgChannel, author, "Please mention a member to match.");
		deleteMsgIfPossible(msg);
		return;
	}

	if (matchMember.id == author.id) {
		sendErrorReply(msgChannel, author, "You can't match yourself.");
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
		sendErrorReply(
			msgChannel,
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
	}

	// figure out gender of both author and match
	const authorGender = getGender(authorMember);
	const matchGender = getGender(matchMember);

	if (authorGender.trim() == "") {
		sendErrorReply(
			msgChannel,
			author,
			"Please add a gender role before starting a match."
		);
		deleteMsgIfPossible(msg);
		return;
	}

	if (matchGender.trim() == "") {
		sendErrorReply(
			msgChannel,
			author,
			`Your match **${
				matchMember.nickname || matchMember.user.username
			}** doesn't have a gender role. Please ask that person to add one first.`
		);
		deleteMsgIfPossible(msg);
		return;
	}

	const authorMemberInfoRes = await getMemberInfo(authorMember.id);
	const matchMemberInfoRes = await getMemberInfo(matchMember.id);

	if (authorMemberInfoRes.isErr()) {
		console.log(authorMemberInfoRes.error);
		deleteMsgIfPossible(msg);
		return;
	}

	if (matchMemberInfoRes.isErr()) {
		console.log(matchMemberInfoRes.error);
		deleteMsgIfPossible(msg);
		return;
	}

	const authorMemberInfo = authorMemberInfoRes.value;
	const matchMemberInfo = matchMemberInfoRes.value;

	if (!authorMemberInfo) {
		sendErrorReply(
			msgChannel,
			author,
			`You are not registered. Please run **${botConfig.PREFIX}register** first.`
		);
		deleteMsgIfPossible(msg);
		return;
	}

	if (!matchMemberInfo) {
		sendErrorReply(
			msgChannel,
			author,
			`Your match is not registered. Please ask that person to run **${botConfig.PREFIX}register** first.`
		);
		deleteMsgIfPossible(msg);
		return;
	}

	deleteMsgIfPossible(msg);

	// create a match channel
	const matchChannel = await createMatchChannel(guild, authorMember);

	if (!matchChannel) {
		return;
	}

	// invite the match
	const inviteMsg = await matchMember.send({
		embed: {
			color: 0xff007f,
			description: `Member **${
				authorMember.nickname || authorMember.user.username
			}** would like to start a private conversation with you.\n\nMember Formation,`,
			image: {
				url:
					authorMember.user.avatarURL() ||
					"https://media2.giphy.com/media/hut4WMshl8Uxdpb0Ff/giphy.gif",
			},
			thumbnail: {
				url: "https://media.tenor.com/images/411a706908ece27575fc0d5e500dde66/tenor.gif",
			},
			fields: getMemberInfoEmbedFields(
				authorMember.nickname || authorMember.user.username,
				authorGender,
				authorMemberInfo
			),
			footer: {
				text: "Please react with 👍 to accept or 👎 to reject.",
			},
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
			authorMember.user,
			matchMember.user,
			`**${
				matchMember.nickname || matchMember.user.username
			}** failed to reply to your invitation.`,
			`You failed to respond to the invitation from **${
				authorMember.nickname || authorMember.user.username
			}**.`
		);
		return;
	}

	const reaction = collected.first();
	if (!reaction) return;

	if (reaction.emoji.name == "👍") {
		sendDualResponse(
			authorMember.user,
			matchMember.user,
			`Member **${
				matchMember.nickname || matchMember.user.username
			}** has confirmed the private chat invitation.`,
			`You have confirmed the private chat invitation to member **${
				authorMember.nickname || authorMember.user.username
			}**.`
		);

		// add the match to date channel
		await matchChannel.createOverwrite(matchMember, { VIEW_CHANNEL: true });

		let msgs = await matchChannel.messages.fetch();
		let botMsgs = msgs.filter((m) => m.author.id == clientUser.id);
		await matchChannel.bulkDelete(botMsgs);

		// send msg
		await matchChannel.send(`<@${authorMember.id}><@${matchMember.id}>,`, {
			embed: {
				title: "Match completed.",
				color: 0xff007f,
				thumbnail: {
					url: "https://media1.tenor.com/images/3d236166f36b07b08c115dc43bc8253f/tenor.gif",
				},
				description: `**This is a private channel only you guys can access. Please close this chat after you are done.**`,
				footer: {
					text: `Please use ${botConfig.PREFIX}done command to close this private chat.`,
				},
			},
		});

		// save
		const matchSaveRes = await saveMatch(
			matchChannel.id,
			authorMember.id,
			matchMember.id
		);

		if (matchSaveRes.isErr()) {
			console.log(matchSaveRes.error);
		}

		const clearPendingMatchRes = await clearPendingMatch(authorMember.id);

		if (clearPendingMatchRes.isErr()) {
			console.log(clearPendingMatchRes.error);
		}
	} else {
		sendDualResponse(
			authorMember.user,
			matchMember.user,
			`**${
				matchMember.nickname || matchMember.user.username
			}** rejected your private chat invitation.`,
			`You have rejected the private chat invitation from **${
				authorMember.nickname || authorMember.user.username
			}**.`
		);
	}
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

const sendErrorReply = async (
	channel: TextChannel,
	user: User,
	text: string
) => {
	await channel
		.send(`<@${user.id}>`, {
			embed: {
				color: 0xff0000,
				description: text,
			},
		})
		.then((m) => m.delete({ timeout: 8000 }));
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
const createMatchChannel = async (guild: Guild, member: GuildMember) => {
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
				{ id: member, allow: "VIEW_CHANNEL" },
			],
			parent: categoryChannel,
		})
		.catch((e) => {
			console.log(
				"Failed to create a dating channel. Please check your bot permissions and configuration."
			);
		});

	if (!datingChannel) return;

	await datingChannel.send(`<@${member.id}>,`, {
		embed: {
			title: "Waiting for a response",
			color: 0xff007f,
			thumbnail: {
				url: "https://media1.tenor.com/images/3d236166f36b07b08c115dc43bc8253f/tenor.gif",
			},
			description: `**I sent an invite to the person you like. Please be patient until that person responds.**`,
			footer: {
				text: `Please use ${botConfig.PREFIX}done command to close this private chat.`,
			},
		},
	});

	return datingChannel;
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

const getMemberInfoEmbedFields = (
	memberName: string,
	gender: string,
	memberInfo: any
) => {
	return [
		{
			name: "Member",
			value: memberName,
			inline: false,
		},
		{
			name: "Gender",
			value: gender,
			inline: true,
		},
		{
			name: "Age",
			value: memberInfo.age,
			inline: true,
		},
		{
			name: "Height",
			value: memberInfo.height,
			inline: true,
		},
		{
			name: "Location",
			value: memberInfo.location,
			inline: true,
		},
		{
			name: "Favorite Color",
			value: memberInfo.fav_color,
			inline: true,
		},
		{
			name: "Favorite Animal",
			value: memberInfo.fav_animal,
			inline: true,
		},
		{
			name: "What makes this person happy?",
			value: memberInfo.happy_reason,
			inline: true,
		},
		{
			name: "ID",
			value: memberInfo.memberId,
			inline: false,
		},
	];
};
