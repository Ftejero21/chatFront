package com.chat.chat.DTO;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class E2EMessagePayloadDTO {
    private String type;
    private String iv;
    private String ciphertext;
    private String forEmisor;
    private String forReceptor;
    private String forAdmin;
    private String auditStatus;

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getIv() {
        return iv;
    }

    public void setIv(String iv) {
        this.iv = iv;
    }

    public String getCiphertext() {
        return ciphertext;
    }

    public void setCiphertext(String ciphertext) {
        this.ciphertext = ciphertext;
    }

    public String getForEmisor() {
        return forEmisor;
    }

    public void setForEmisor(String forEmisor) {
        this.forEmisor = forEmisor;
    }

    public String getForReceptor() {
        return forReceptor;
    }

    public void setForReceptor(String forReceptor) {
        this.forReceptor = forReceptor;
    }

    public String getForAdmin() {
        return forAdmin;
    }

    public void setForAdmin(String forAdmin) {
        this.forAdmin = forAdmin;
    }

    public String getAuditStatus() {
        return auditStatus;
    }

    public void setAuditStatus(String auditStatus) {
        this.auditStatus = auditStatus;
    }
}
