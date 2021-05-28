import {
	CategoryChannel,
	Client,
	Guild,
	GuildMember,
	Message,
	MessageEmbed,
	TextChannel,
} from "discord.js";
import {
	getMemberInfo,
	getPendingMatch,
	savePendingMatch,
} from "../../../data";
const Pagination = require("discord-paginationembed");

import { getBotConfig, getReactionRoleConfig } from "../../../util/config";
import { parseYAML } from "../../../util/parse";

const botConfig: any = getBotConfig();
const cmdConfig: any = parseYAML(`${__dirname}/swipe.yaml`);
const reactionRoleConfig: any = getReactionRoleConfig();

export const handle = async (msg: Message) => {
	const genderRoleNames = reactionRoleConfig["ROLE NAMES"];

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
		msg.delete({ timeout: 5000 });
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
		msg.delete({ timeout: 5000 });

		return;
	}

	const authorMember = msg.member;

	if (!msg.guild || !authorMember) {
		msg.delete({ timeout: 5000 }).catch((e) => {});
		return;
	}

	const checkRes = await getPendingMatch(authorMember.id);

	if (checkRes.isErr()) {
		console.log(checkRes.error);
		msg.delete({ timeout: 5000 });
		return;
	}

	const record = checkRes.value;

	if (record) {
		msg
			.reply(
				`**You already have a match open in <#${checkRes.value.channelId}>. Please close it first before running this command.**`
			)
			.then((m) => m.delete({ timeout: 10000 }));
		msg.delete({ timeout: 5000 }).catch((e) => {});
		return;
	}

	const matchChannel = await createMatchChannel(msg.guild, authorMember);

	if (!matchChannel) {
		msg.delete({ timeout: 5000 }).catch((e) => {});
		return;
	}

	const embeds: Array<MessageEmbed> = [];

	for (const member of mentionedGenderRole.members.array()) {
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

		embed.fields = [
			{
				name: "Member",
				value: member.nickname || member.user.username,
				inline: false,
			},
			{
				name: "Gender",
				value: genderRoleNames[mentionedGenderRole.id],
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
				value: member.id,
				inline: false,
			},
		];
		embeds.push(embed);
	}

	if (embeds.length == 0) {
		const embed = new MessageEmbed();
		embed.setDescription("Sorry!. There are no members with this role.");
		embeds.push(embed);
	}

	const paginatedEmbed = new Pagination.Embeds()
		.setArray(embeds)
		.setAuthorizedUsers([msg.author.id])
		.setChannel(matchChannel)
		.setColor(0xff007f)
		.setPageIndicator(false)
		.setEmojisFunctionAfterNavigation(true)
		.addFunctionEmoji("💓", (_: any, instance: any) => {
			inviteMatch(authorMember, matchChannel, msg.client);
		})
		.build();

	const res = await savePendingMatch(msg.author.id, matchChannel.id);

	if (res.isErr()) {
		console.log(res.error);
		console.log("Failed to saved the pending match.");
	}
};

const inviteMatch = async (
	authorMember: GuildMember,
	matchChannel: TextChannel,
	client: Client
) => {
	const clientUser = client.user;
	let matchId: string = "";

	if (!clientUser) {
		console.log("failed to find client user");
		return;
	}

	const msgs = await matchChannel.messages.fetch();
	msgs.every((msg) => {
		if (msg.embeds.length == 0) return true;
		if (msg.author.id != clientUser.id) return true;

		for (const embed of msg.embeds) {
			const field = embed.fields.find((f) => f.name == "ID");
			if (!field) continue;
			matchId = field.value;
			return false;
		}

		return true;
	});

	// delete all bot msgs
	const botMsgs = msgs.filter((m) => m.author.id == clientUser.id);
	await matchChannel.bulkDelete(botMsgs);

	await matchChannel.send(`<@${authorMember.id}>,`, {
		embed: {
			title: "Waiting for an response",
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
