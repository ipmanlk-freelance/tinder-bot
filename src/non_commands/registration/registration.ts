import { Guild, GuildMember, Message, MessageEmbed, User } from "discord.js";
import { saveMemberInfo } from "../../data";
import { getBotConfig, getReactionRoleConfig } from "../../util/config";

const botConfig: any = getBotConfig();
const reactionRoleConfig: any = getReactionRoleConfig();

export const startRegistration = async (
	member: GuildMember,
	guild: Guild,
	genderRoleMsg: Message
) => {
	let userAge, userLocation, favColor, favAnimal, height, happyReason;

	const user = member.user;

	try {
		userAge = await getAge(user);
	} catch (e) {
		sendErrorDM(
			user,
			`You failed to provide your age. Please run **${botConfig.PREFIX}register** in any channel in ${guild.name} to restart this.`
		);
		removeReaction(genderRoleMsg, user.id);
		return;
	}

	try {
		userLocation = await getStringResponse(
			user,
			"What is your location?",
			"Failed to provide the location",
			"Please provide a valid location"
		);
	} catch (e) {
		sendErrorDM(
			user,
			`You failed to provide your location. Please run **${botConfig.PREFIX}register** in any channel in ${guild.name} to restart this.`
		);
		removeReaction(genderRoleMsg, user.id);
		return;
	}

	try {
		favColor = await getStringResponse(
			user,
			"What is your favourite color?",
			"Failed to provide the favourite color",
			"Please provide your favourite color"
		);
	} catch (e) {
		sendErrorDM(
			user,
			`You failed to provide your favourite color. Please run **${botConfig.PREFIX}register** in any channel in ${guild.name} to restart this.`
		);
		removeReaction(genderRoleMsg, user.id);
		return;
	}

	try {
		favAnimal = await getStringResponse(
			user,
			"What is your favourite animal?",
			"Failed to provide the favourite animal",
			"Please provide your favourite animal"
		);
	} catch (e) {
		sendErrorDM(
			user,
			`You failed to provide your favourite animal. Please run **${botConfig.PREFIX}register** in any channel in ${guild.name} to restart this.`
		);
		removeReaction(genderRoleMsg, user.id);
		return;
	}

	try {
		height = await getStringResponse(
			user,
			"How tall are you?",
			"Failed to provide the height",
			"Please provide your height"
		);
	} catch (e) {
		sendErrorDM(
			user,
			`You failed to provide your height. Please run **${botConfig.PREFIX}register** in any channel in ${guild.name} to restart this.`
		);
		removeReaction(genderRoleMsg, user.id);
		return;
	}

	try {
		happyReason = await getStringResponse(
			user,
			"what makes you happy in life?",
			"Failed to provide an answer",
			"Please tell me what makes you happy in life"
		);
	} catch (e) {
		sendErrorDM(
			user,
			`You failed to provide a response. Please run **${botConfig.PREFIX}register** in any channel in ${guild.name} to restart this.`
		);
		removeReaction(genderRoleMsg, user.id);
		return;
	}

	const res = await saveMemberInfo(
		user.id,
		userAge,
		userLocation,
		favColor,
		favAnimal,
		height,
		happyReason
	);

	if (res.isErr()) {
		console.log(res.error);
		sendErrorDM(
			user,
			"Failed to complete your registration. Please contact the staff."
		);
		removeReaction(genderRoleMsg, user.id);
		return;
	}

	const avatarUrl = user.avatarURL();
	const successEmbed = new MessageEmbed();

	successEmbed.setTitle("Registration Completed!.");
	successEmbed.setColor(0xff007f);
	if (avatarUrl) {
		successEmbed.setImage(avatarUrl);
	}
	successEmbed.setThumbnail(
		"https://media1.tenor.com/images/3d236166f36b07b08c115dc43bc8253f/tenor.gif"
	);
	successEmbed.addField("Name", member.nickname || member.user.username);
	successEmbed.addField("Gender", getGender(member));
	successEmbed.addField("Age", userAge);
	successEmbed.addField("Favorite Color", favColor);
	successEmbed.addField("Favorite Animal", favAnimal);
	successEmbed.addField("What makes you happy?", happyReason);
	successEmbed.setFooter(
		`You can now run **${botConfig.PREFIX}match** command to file matches in ${guild.name} server`
	);

	user.send({ embed: successEmbed });
};

const removeReaction = async (msg: Message, userId: string) => {
	const userReactions = msg.reactions.cache.filter((reaction) =>
		reaction.users.cache.has(userId)
	);
	try {
		for (const reaction of userReactions.array()) {
			await reaction.users.remove(userId);
		}
	} catch (error) {
		console.error("Failed to remove reactions.");
	}
};

const getAge = async (user: User) => {
	let age: number = 0;

	while (age == 0) {
		const filter = (m: Message) => m.author.id == user.id;

		const dm = await user.send({
			embed: {
				color: 0xff007f,
				description: "How old are you?",
				footer: {
					text: "Your age should be above 16",
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
			parseInt(collectedAge) >= 17
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

const getStringResponse = async (
	user: User,
	request: string,
	nonError: string,
	invalidError: string
) => {
	let response: string = "";

	while (response == "") {
		const filter = (m: Message) => m.author.id == user.id;

		const dm = await user.send({
			embed: {
				color: 0xff007f,
				description: request,
			},
		});

		const collected = await dm.channel.awaitMessages(filter, {
			max: 1,
			time: 300000,
		});

		if (collected.size == 0) {
			throw nonError;
		}

		const collectedResponse = collected.first()?.content;

		if (collectedResponse && collectedResponse.trim() != "") {
			response = collectedResponse.trim();
		} else {
			user.send({
				embed: {
					color: 0xff0000,
					description: invalidError,
				},
			});
		}
	}
	return response;
};

const sendErrorDM = async (user: User, text: string) => {
	await user.send({
		embed: {
			color: 0xff0000,
			description: text,
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
