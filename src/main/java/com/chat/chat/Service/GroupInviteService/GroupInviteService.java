package com.chat.chat.Service.GroupInviteService;

import com.chat.chat.DTO.GroupInviteWS;

public interface GroupInviteService {
    GroupInviteWS create(Long groupId, Long inviteeId, Long requesterId);
    void accept(Long inviteId, Long userId);
    void decline(Long inviteId, Long userId);
}
