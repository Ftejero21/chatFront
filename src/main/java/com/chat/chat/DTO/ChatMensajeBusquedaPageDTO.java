package com.chat.chat.DTO;

import java.util.ArrayList;
import java.util.List;

public class ChatMensajeBusquedaPageDTO {
    private List<ChatMensajeBusquedaItemDTO> items = new ArrayList<>();
    private int page;
    private int size;
    private long total;
    private boolean hasMore;

    public List<ChatMensajeBusquedaItemDTO> getItems() {
        return items;
    }

    public void setItems(List<ChatMensajeBusquedaItemDTO> items) {
        this.items = items;
    }

    public int getPage() {
        return page;
    }

    public void setPage(int page) {
        this.page = page;
    }

    public int getSize() {
        return size;
    }

    public void setSize(int size) {
        this.size = size;
    }

    public long getTotal() {
        return total;
    }

    public void setTotal(long total) {
        this.total = total;
    }

    public boolean isHasMore() {
        return hasMore;
    }

    public void setHasMore(boolean hasMore) {
        this.hasMore = hasMore;
    }
}
