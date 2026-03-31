package com.chat.chat.DTO;

import org.antlr.v4.runtime.misc.NotNull;

public class LeaveGroupRequestDTO {


    private Long groupId;


    private Long userId;

    public LeaveGroupRequestDTO() {}

    public LeaveGroupRequestDTO(Long groupId, Long userId) {
        this.groupId = groupId;
        this.userId = userId;
    }

    public Long getGroupId() { return groupId; }
    public void setGroupId(Long groupId) { this.groupId = groupId; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
}