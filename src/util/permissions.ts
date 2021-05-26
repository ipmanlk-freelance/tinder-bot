import { GuildMember } from "discord.js";

export const checkMemberHasPermission = (
	member: GuildMember,
	allowedRoleIds: Array<string>
) => {
	let isAllowed: boolean = false;
	allowedRoleIds.every((roleId) => {
		if (roleId == "PUBLIC") {
			isAllowed = true;
			return false;
		}
		if (roleId == "ADMIN" && member.hasPermission("ADMINISTRATOR")) {
			isAllowed = true;
			return false;
		}
		const role = member.roles.cache.get(roleId);
		if (role) {
			isAllowed = true;
			return false;
		}
		return true;
	});
	return isAllowed;
};
