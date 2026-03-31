package com.chat.chat.DTO;

import com.chat.chat.Utils.InviteStatus;

public class GroupInviteResponseWS {

    public Long inviteId;
    public Long groupId;
    public String groupName;
    public Long inviteeId;
    public String inviteeNombre;
    public InviteStatus status;   // ACCEPTED / DECLINED
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

    public Long getInviteeId() {
        return inviteeId;
    }

    public void setInviteeId(Long inviteeId) {
        this.inviteeId = inviteeId;
    }

    public String getInviteeNombre() {
        return inviteeNombre;
    }

    public void setInviteeNombre(String inviteeNombre) {
        this.inviteeNombre = inviteeNombre;
    }

    public InviteStatus getStatus() {
        return status;
    }

    public void setStatus(InviteStatus status) {
        this.status = status;
    }

    public int getUnseenCount() {
        return unseenCount;
    }

    public void setUnseenCount(int unseenCount) {
        this.unseenCount = unseenCount;
    }
}
