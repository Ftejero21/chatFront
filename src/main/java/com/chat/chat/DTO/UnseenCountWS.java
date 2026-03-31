package com.chat.chat.DTO;

public class UnseenCountWS {

    public Long userId;
    public int unseenCount;
    public UnseenCountWS(Long userId, int unseenCount) {
        this.userId = userId;
        this.unseenCount = unseenCount;
    }



    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public int getUnseenCount() {
        return unseenCount;
    }

    public void setUnseenCount(int unseenCount) {
        this.unseenCount = unseenCount;
    }
}
