package com.chat.chat.DTO;

public class AudioUploadResponseDTO {
    private String url;
    private String mime;
    private String fileName;
    private Long sizeBytes;
    private Integer durMs;

    public AudioUploadResponseDTO() {
    }

    public AudioUploadResponseDTO(String url, String mime, String fileName, Long sizeBytes, Integer durMs) {
        this.url = url;
        this.mime = mime;
        this.fileName = fileName;
        this.sizeBytes = sizeBytes;
        this.durMs = durMs;
    }

    public String getUrl() {
        return url;
    }

    public void setUrl(String url) {
        this.url = url;
    }

    public String getMime() {
        return mime;
    }

    public void setMime(String mime) {
        this.mime = mime;
    }

    public String getFileName() {
        return fileName;
    }

    public void setFileName(String fileName) {
        this.fileName = fileName;
    }

    public Long getSizeBytes() {
        return sizeBytes;
    }

    public void setSizeBytes(Long sizeBytes) {
        this.sizeBytes = sizeBytes;
    }

    public Integer getDurMs() {
        return durMs;
    }

    public void setDurMs(Integer durMs) {
        this.durMs = durMs;
    }
}
