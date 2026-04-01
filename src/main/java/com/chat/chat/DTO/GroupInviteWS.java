package com.chat.chat.DTO;

public class GroupInviteWS {

    public Long inviteId;
    public Long groupId;
    public String groupName;
    public Long inviterId;
    public String inviterNombre;  // o lo que tengas
    public int unseenCount;

    public Long getInviteId() {
        return inviteId;
    }

    public void setInviteId(Long inviteId) {
        this.inviteId = inviteId;
    }

    public Long getGroupId() {
        return groupId;
    }

    public void setGroupId(Long groupId) {
        this.groupId = groupId;
    }

    public String getGroupName() {
        return groupName;
    }

    public void setGroupName(String groupName) {
        this.groupName = groupName;
    }

    public Long getInviterId() {
        return inviterId;
    }

    public void setInviterId(Long inviterId) {
        this.inviterId = inviterId;
    }

    public String getInviterNombre() {
        return inviterNombre;
    }

    public void setInviterNombre(String inviterNombre) {
        this.inviterNombre = inviterNombre;
    }

    public int getUnseenCount() {
        return unseenCount;
    }

    public void setUnseenCount(int unseenCount) {
        this.unseenCount = unseenCount;
    }
}
