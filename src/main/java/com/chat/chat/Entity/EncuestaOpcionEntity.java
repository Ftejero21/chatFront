package com.chat.chat.Entity;

import jakarta.persistence.*;

@Entity
@Table(
        name = "poll_option",
        indexes = {
                @Index(name = "idx_poll_option_poll", columnList = "poll_id")
        },
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_poll_option_key", columnNames = {"poll_id", "option_key"})
        }
)
public class EncuestaOpcionEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "poll_id", nullable = false)
    private EncuestaEntity encuesta;

    @Column(name = "option_key", nullable = false, length = 120)
    private String optionKey;

    @Column(name = "option_text", nullable = false, length = 500)
    private String optionText;

    @Column(name = "order_index", nullable = false)
    private Integer orderIndex;

    @Column(name = "vote_count", nullable = false)
    private Long voteCount = 0L;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public EncuestaEntity getEncuesta() {
        return encuesta;
    }

    public void setEncuesta(EncuestaEntity encuesta) {
        this.encuesta = encuesta;
    }

    public String getOptionKey() {
        return optionKey;
    }

    public void setOptionKey(String optionKey) {
        this.optionKey = optionKey;
    }

    public String getOptionText() {
        return optionText;
    }

    public void setOptionText(String optionText) {
        this.optionText = optionText;
    }

    public Integer getOrderIndex() {
        return orderIndex;
    }

    public void setOrderIndex(Integer orderIndex) {
        this.orderIndex = orderIndex;
    }

    public Long getVoteCount() {
        return voteCount;
    }

    public void setVoteCount(Long voteCount) {
        this.voteCount = voteCount;
    }
}
