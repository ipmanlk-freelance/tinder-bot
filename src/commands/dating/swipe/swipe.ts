import {
	CategoryChannel,
	Client,
	Guild,
	GuildMember,
	Message,
	MessageEmbed,
	MessageReaction,
	Role,
	TextChannel,
	User,
} from "discord.js";
import {
	clearPendingMatch,
	getMemberInfo,
	getPendingMatch,
	saveMatch,
	savePendingMatch,
} from "../../../data";
const Pagination = require("discord-paginationembed");

import { getBotConfig, getReactionRoleConfig } from "../../../util/config";
import { parseYAML } from "../../../util/parse";

const botConfig: any = getBotConfig();
const cmdConfig: any = parseYAML(`${__dirname}/swipe.yaml`);
const reactionRoleConfig: any = getReactionRoleConfig();
const genderRoleNames = reactionRoleConfig["ROLE NAMES"];

export const handle = async (msg: Message) => {
	if (!msg.member) return;

	const client = msg.client;

	// check author has a gender role
	const authorGender = getGender(msg.member);
	if (authorGender.trim() == "") {
		msg
			.reply({
				embed: {
					color: 0xff0000,
					description:
						"Please add a gender role first before starting a swipe.",
				},
			})
			.then((m) => m.delete({ timeout: 5000 }));
		msg.react("🛑");
		msg.delete({ timeout: 5000 }).catch((e) => {});
		return;
	}

	// check member is registered
	const authorInfoRes = await getMemberInfo(msg.author.id);

	if (authorInfoRes.isErr()) {
		console.log("Unable to access the database.");
		console.log(authorInfoRes.error);
		return;
	}

	if (!authorInfoRes.value) {
		msg
			.reply({
				embed: {
					title: "You are not registered!.",
					color: 0xff0000,
					description: `Please register with **${botConfig.PREFIX}register** command before running a swipe.`,
				},
			})
			.then((m) => m.delete({ timeout: 10000 }));
		msg.react("🛑");
		msg.delete({ timeout: 5000 }).catch((e) => {});
		return;
	}

	const mentionedGenderRole = msg.mentions.roles.first();

	if (!mentionedGenderRole) {
		msg
			.reply({
				embed: {
					color: 0xff0000,
					description: "Please mention a gender role.",
				},
			})
			.then((m) => m.delete({ timeout: 5000 }));
		msg.react("🛑");
		msg.delete({ timeout: 5000 }).catch((e) => {});
		return;
	}

	if (!Object.keys(genderRoleNames).includes(mentionedGenderRole.id)) {
		msg
			.reply({
				embed: {
					color: 0xff0000,
					description: "Please mention a valid gender role.",
				},
			})
			.then((m) => m.delete({ timeout: 5000 }));
		msg.react("🛑");
		msg.delete({ timeout: 5000 }).catch((e) => {});
		return;
	}

	const authorMember = msg.member;
	const guild = msg.guild;

	msg.delete({ timeout: 5000 }).catch((e) => {});

	if (!guild || !authorMember) {
		return;
	}

	const checkRes = await getPendingMatch(authorMember.id);

	if (checkRes.isErr()) {
		console.log(checkRes.error);
		return;
	}

	const record = checkRes.value;

	if (record) {
		msg
			.reply(
				`**You already have a match open in <#${checkRes.value.channelId}>. Please close it first before running this command.**`
			)
			.then((m) => m.delete({ timeout: 10000 }));
		return;
	}

	const matchChannel = await createMatchChannel(guild, authorMember);

	if (!matchChannel) {
		return;
	}

	const res = await savePendingMatch(authorMember.id, matchChannel.id);

	if (res.isErr()) {
		console.log(res.error);
		console.log("Failed to saved the pending match.");
	}

	await buildPaginationEmbed(
		mentionedGenderRole,
		authorMember,
		matchChannel,
		client
	);
};

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

	datingChannel.send(`<@${member.user.id}>,`, {
		embed: {
			title: "Swipe Channel",
			color: 0xff007f,
			thumbnail: {
				url: "https://media1.tenor.com/images/9586846990183c06e768204cd0593eee/tenor.gif?itemid=4988595",
			},
			description: `Please be patient. You will get all machines in a few moments.\n\nYou can select a match to contact by reacting with 💓.`,
			footer: {
				text: `Please use ${botConfig.PREFIX}done command to close this private chat.`,
			},
		},
	});

	return datingChannel;
};

const inviteMatch = async (
	authorMember: GuildMember,
	gender: string,
	matchChannel: TextChannel,
	client: Client
) => {
	const clientUser = client.user;
	let matchId: string = "";

	if (!clientUser) {
		console.log("failed to find client user");
		return;
	}

	let msgs = await matchChannel.messages.fetch();
	let botMsgs = msgs.filter((m) => m.author.id == clientUser.id);

	botMsgs.every((msg) => {
		if (msg.embeds.length == 0) return true;
		if (msg.author.id != clientUser.id) return true;

		for (const embed of msg.embeds) {
			const field = embed.fields.find((f) => {
				return f.name.trim() == "ID";
			});
			if (!field) return true;
			matchId = field.value;
			return false;
		}
		return true;
	});

	// delete all bot msgs
	await matchChannel.bulkDelete(botMsgs);

	await matchChannel.send(`<@${authorMember.id}>,`, {
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

	const matchMember = await matchChannel.guild.members.fetch(matchId);

	if (!matchMember || !matchMember.id) {
		console.log(`ID: ${matchId} member not found.`);
		return;
	}

	const authorInfoRes = await getMemberInfo(authorMember.user.id);

	if (authorInfoRes.isErr()) {
		console.log("Unable to get member info.");
		console.log(authorInfoRes.error);
		return;
	}

	const memberInfo = authorInfoRes.value;

	if (!memberInfo) {
		console.log(`Member ${matchMember.id} is not registered.`);
		return;
	}

	// get a response from the match
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
				gender,
				memberInfo
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

		msgs = await matchChannel.messages.fetch();
		botMsgs = msgs.filter((m) => m.author.id == clientUser.id);
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

const buildPaginationEmbed = async (
	mentionedGenderRole: Role,
	authorMember: GuildMember,
	matchChannel: TextChannel,
	client: Client
) => {
	// check if this is a pending match
	const pendingMatchRes = await getPendingMatch(authorMember.id);

	if (pendingMatchRes.isErr() || !pendingMatchRes.value) {
		return;
	}

	// delete if there are any paginated embeds in the match channel
	let paginatedEmbedMsg: Message | undefined;
	const matchChannelMsgs = await matchChannel.messages.fetch();
	for (const msg of matchChannelMsgs.array()) {
		if (msg.embeds.length == 0 || msg.author.id != client.user?.id) continue;
		let embedString = "";
		msg.embeds.forEach((eb) => {
			embedString += JSON.stringify(eb.toJSON());
		});

		if (embedString.includes("14980362bff8218406381df35beaa368.gif")) {
			paginatedEmbedMsg = msg;
			break;
		}
	}

	if (paginatedEmbedMsg) {
		await paginatedEmbedMsg.delete();
	}

	const embeds: Array<MessageEmbed> = [];

	for (const member of mentionedGenderRole.members.array()) {
		// ignore author info
		if (member.id == authorMember.id) continue;

		const embed = new MessageEmbed();
		const avatarUrl = member.user.avatarURL();

		if (avatarUrl) {
			embed.setImage(avatarUrl);
		}
		embed.setThumbnail(
			"https://cdn.discordapp.com/attachments/847152087304241182/847154551748558848/14980362bff8218406381df35beaa368.gif"
		);

		const res = await getMemberInfo(member.id);

		if (res.isErr()) continue;

		const memberInfo = res.value;

		if (!memberInfo) continue;

		embed.fields = getMemberInfoEmbedFields(
			member.nickname || member.user.username,
			genderRoleNames[mentionedGenderRole.id],
			memberInfo
		);

		embeds.push(embed);
	}

	if (embeds.length == 0) {
		const embed = new MessageEmbed();
		embed.setDescription("Sorry!. There are no members with this role.");
		embeds.push(embed);
	}

	setTimeout(() => {
		new Pagination.Embeds()
			.setArray(embeds)
			.setAuthorizedUsers([authorMember.id])
			.setChannel(matchChannel)
			.setColor(0xff007f)
			.setPageIndicator(false)
			.setEmojisFunctionAfterNavigation(true)
			.setDeleteOnTimeout(false)
			.setTimeout(60 * 60000)
			.setDisabledNavigationEmojis(["delete"])
			.addFunctionEmoji("💓", (_: any, instance: any) => {
				inviteMatch(
					authorMember,
					getGender(authorMember),
					matchChannel,
					client
				);
			})
			.on("expire", () => {
				console.log("Embed expired. Rebuilding.");
				buildPaginationEmbed(
					mentionedGenderRole,
					authorMember,
					matchChannel,
					client
				);
			})
			.on("error", (e: any) => {
				console.log(e);
				buildPaginationEmbed(
					mentionedGenderRole,
					authorMember,
					matchChannel,
					client
				);
			})
			.build();
	}, 3000);
};
