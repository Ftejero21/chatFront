package com.chat.chat.Configuracion;

import com.chat.chat.Utils.Constantes;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.CacheControl;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class StaticResourceConfig implements WebMvcConfigurer {

    @Value("${app.uploads.root:uploads}")
    private String uploadsRoot;

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        String avatarsLocation = "file:" + uploadsRoot + "/" + Constantes.DIR_AVATARS + "/";
        registry.addResourceHandler(Constantes.UPLOADS_PREFIX + Constantes.DIR_AVATARS + "/**")
                .addResourceLocations(avatarsLocation)
                .setCacheControl(CacheControl.noCache());

        String groupPhotosLocation = "file:" + uploadsRoot + "/" + Constantes.DIR_GROUP_PHOTOS + "/";
        registry.addResourceHandler(Constantes.UPLOADS_PREFIX + Constantes.DIR_GROUP_PHOTOS + "/**")
                .addResourceLocations(groupPhotosLocation)
                .setCacheControl(CacheControl.noCache());
    }
}
