package com.chat.chat.DTO;

import java.util.ArrayList;
import java.util.List;

public class GroupMediaPageDTO {
    private List<GroupMediaItemDTO> items = new ArrayList<>();
    private String nextCursor;
    private boolean hasMore;

    public List<GroupMediaItemDTO> getItems() {
        return items;
    }

    public void setItems(List<GroupMediaItemDTO> items) {
        this.items = items;
    }

    public String getNextCursor() {
        return nextCursor;
    }

    public void setNextCursor(String nextCursor) {
        this.nextCursor = nextCursor;
    }

    public boolean isHasMore() {
        return hasMore;
    }

    public void setHasMore(boolean hasMore) {
        this.hasMore = hasMore;
    }
}
