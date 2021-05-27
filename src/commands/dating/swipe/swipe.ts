import {
	CategoryChannel,
	Guild,
	GuildMember,
	Message,
	MessageEmbed,
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

	if (!msg.guild || !msg.member) {
		msg.delete({ timeout: 5000 }).catch((e) => {});
		return;
	}

	const checkRes = await getPendingMatch(msg.member.id);

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

	const matchChannel = await createMatchChannel(msg.guild, msg.member);

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

	new Pagination.Embeds()
		.setArray(embeds)
		.setAuthorizedUsers([msg.author.id])
		.setChannel(matchChannel)
		.setColor(0xff007f)
		.setPageIndicator(false)
		.addFunctionEmoji("💓", (_: any, instance: any) => {
			matchChannel.send("This will run a match (test)");
		})
		.setEmojisFunctionAfterNavigation(true)
		.build();

	const res = await savePendingMatch(msg.author.id, matchChannel.id);

	if (res.isErr()) {
		console.log(res.error);
		console.log("Failed to saved the pending match.");
	}
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
			description: `Please be patient. You will get all machines in a few moments.\n\nYou can select a match to contact by reacting with ().`,
			footer: {
				text: `Please use ${botConfig.PREFIX}done command to close this private chat.`,
			},
		},
	});

	return datingChannel;
};
