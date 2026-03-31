package com.chat.chat.Configuracion;

import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.util.StringUtils;

import java.util.Properties;

@Configuration
public class MailConfig {
    private static final Logger LOGGER = LoggerFactory.getLogger(MailConfig.class);
    private static final String MAIL_HOST_PROP = "${spring.mail.host:smtp.gmail.com}";
    private static final String MAIL_PORT_PROP = "${spring.mail.port:587}";
    private static final String MAIL_USERNAME_PROP = "${spring.mail.username:}";
    private static final String MAIL_PASSWORD_PROP = "${spring.mail.password:}";
    private static final String PROP_TRANSPORT = "mail.transport.protocol";
    private static final String PROP_SMTP_AUTH = "mail.smtp.auth";
    private static final String PROP_SMTP_STARTTLS = "mail.smtp.starttls.enable";
    private static final String SMTP = "smtp";
    private static final String TRUE = "true";

    @Value(MAIL_HOST_PROP)
    private String host;

    @Value(MAIL_PORT_PROP)
    private int port;

    @Value(MAIL_USERNAME_PROP)
    private String username;

    @Value(MAIL_PASSWORD_PROP)
    private String password;

    @PostConstruct
    public void validateMailConfig() {
        if (!StringUtils.hasText(username) || !StringUtils.hasText(password)) {
            LOGGER.warn("[MAIL_CONFIG] Credenciales SMTP vacias. Define SPRING_MAIL_USERNAME y SPRING_MAIL_PASSWORD.");
        }
    }

    @Bean
    public JavaMailSender javaMailSender() {
        JavaMailSenderImpl mailSender = new JavaMailSenderImpl();
        mailSender.setHost(host);
        mailSender.setPort(port);
        mailSender.setUsername(username);
        mailSender.setPassword(password);

        Properties props = mailSender.getJavaMailProperties();
        props.put(PROP_TRANSPORT, SMTP);
        props.put(PROP_SMTP_AUTH, TRUE);
        props.put(PROP_SMTP_STARTTLS, TRUE);

        return mailSender;
    }
}
