package com.chat.chat.DTO;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class EncuestaOpcionDTO {
    private String id;
    private String text;
    private Long voteCount;
    @JsonAlias("voter_ids")
    private List<Long> voterIds;
    private List<EncuestaVotanteDTO> voters;
    private Boolean votedByMe;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getText() {
        return text;
    }

    public void setText(String text) {
        this.text = text;
    }

    public Long getVoteCount() {
        return voteCount;
    }

    public void setVoteCount(Long voteCount) {
        this.voteCount = voteCount;
    }

    public List<Long> getVoterIds() {
        return voterIds;
    }

    public void setVoterIds(List<Long> voterIds) {
        this.voterIds = voterIds;
    }

    public List<EncuestaVotanteDTO> getVoters() {
        return voters;
    }

    public void setVoters(List<EncuestaVotanteDTO> voters) {
        this.voters = voters;
    }

    public Boolean getVotedByMe() {
        return votedByMe;
    }

    public void setVotedByMe(Boolean votedByMe) {
        this.votedByMe = votedByMe;
    }
}
