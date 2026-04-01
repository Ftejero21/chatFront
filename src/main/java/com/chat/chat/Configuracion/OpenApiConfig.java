package com.chat.chat.Configuracion;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    private static final String BEARER_AUTH = "bearerAuth";

    @Bean
    public OpenAPI chatOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("TejeChat API")
                        .version("v1")
                        .description("Documentacion REST de TejeChat. Incluye autenticacion, usuarios, chats, mensajeria, notificaciones y administracion.")
                        .contact(new Contact()
                                .name("Equipo Backend")
                                .email("backend@tejechat.local")))
                .addSecurityItem(new SecurityRequirement().addList(BEARER_AUTH))
                .components(new Components()
                        .addSecuritySchemes(BEARER_AUTH, new SecurityScheme()
                                .name(BEARER_AUTH)
                                .type(SecurityScheme.Type.HTTP)
                                .scheme("bearer")
                                .bearerFormat("JWT")
                                .description("Token JWT en el header Authorization: Bearer <token>")));
    }
}
