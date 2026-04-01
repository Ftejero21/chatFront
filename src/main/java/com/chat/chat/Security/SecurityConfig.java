package com.chat.chat.Security;

import com.chat.chat.Utils.Constantes;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;

import java.util.Arrays;
import java.util.List;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    private static final String MATCH_ALL = "/**";
    private static final String SWAGGER_UI = "/swagger-ui/**";
    private static final String SWAGGER_UI_HTML = "/swagger-ui.html";
    private static final String API_DOCS = "/v3/api-docs/**";
    private static final String API_UPLOADS_PATTERN = "/api/uploads/**";
    private static final String API_UPLOADS_FILE = "/api/uploads/file";
    private static final String API_UPLOADS_MEDIA = "/api/uploads/media";
    private static final String API_UPLOADS_AUDIO = "/api/uploads/audio";
    private static final String PUBLIC_AVATARS_PATTERN = "/uploads/avatars/**";
    private static final String PUBLIC_GROUP_PHOTOS_PATTERN = "/uploads/group-photos/**";
    private static final String CORS_METHOD_POST = "POST";
    private static final String CORS_METHOD_OPTIONS = "OPTIONS";
    private static final String CORS_HEADER_CONTENT_TYPE = "Content-Type";
    private static final String CORS_HEADER_ACCEPT = "Accept";

    @Autowired
    private JwtAuthFilter jwtAuthFilter;

    @Autowired
    private CorsPreflightDebugFilter corsPreflightDebugFilter;

    @Autowired
    private CustomUserDetailsService userDetailsService;

    @Autowired
    private SecurityDebugAuthenticationEntryPoint securityDebugAuthenticationEntryPoint;

    @Autowired
    private SecurityDebugAccessDeniedHandler securityDebugAccessDeniedHandler;

    @Bean
    public FilterRegistrationBean<JwtAuthFilter> jwtAuthFilterRegistration(JwtAuthFilter filter) {
        FilterRegistrationBean<JwtAuthFilter> registration = new FilterRegistrationBean<>(filter);
        registration.setEnabled(false);
        return registration;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .csrf(csrf -> csrf
                        .ignoringRequestMatchers(API_UPLOADS_PATTERN)
                        .disable())
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, MATCH_ALL).permitAll()
                        .requestMatchers(HttpMethod.POST, API_UPLOADS_FILE, API_UPLOADS_MEDIA, API_UPLOADS_AUDIO)
                        .hasAnyAuthority(Constantes.ROLE_USUARIO, Constantes.ROLE_USER, Constantes.ROLE_ADMIN)
                        .requestMatchers(SWAGGER_UI, SWAGGER_UI_HTML, API_DOCS).permitAll()
                        .requestMatchers(
                                Constantes.USUARIO_API + Constantes.LOGIN,
                                Constantes.USUARIO_API + Constantes.REGISTRO,
                                Constantes.USUARIO_API + Constantes.GOOGLE_AUTH,
                                Constantes.USUARIO_API + Constantes.GOOGLE_AUTH_ALIAS,
                                Constantes.USUARIO_API + Constantes.GOOGLE_AUTH_MODE_PATTERN,
                                Constantes.USUARIO_API,
                                Constantes.USUARIO_API + Constantes.RECUPERAR_PASSWORD_ALL,
                                Constantes.USUARIO_API + Constantes.SOLICITUD_DESBANEO_CREATE
                        ).permitAll()
                        .requestMatchers(Constantes.WS_ENDPOINT_PATTERN).permitAll()
                        .requestMatchers(PUBLIC_AVATARS_PATTERN, PUBLIC_GROUP_PHOTOS_PATTERN).permitAll()
                        .requestMatchers("/error").permitAll()
                        .requestMatchers(HttpMethod.GET, Constantes.API_MENSAJES + Constantes.MENSAJES_DESTACADOS).authenticated()
                        .requestMatchers(Constantes.API_MENSAJES + "/**").authenticated()
                        .requestMatchers(Constantes.USUARIO_API + Constantes.USUARIO_ADMIN_PATTERN).hasRole(Constantes.ADMIN)
                        .requestMatchers(Constantes.API_AI_PATTERN).hasRole(Constantes.ADMIN)
                        .anyRequest().authenticated())
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint(securityDebugAuthenticationEntryPoint)
                        .accessDeniedHandler(securityDebugAccessDeniedHandler))
                .sessionManagement(sess -> sess.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authenticationProvider(authenticationProvider())
                .addFilterBefore(corsPreflightDebugFilter, CorsFilter.class)
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public AuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider authProvider = new DaoAuthenticationProvider();
        authProvider.setUserDetailsService(userDetailsService);
        authProvider.setPasswordEncoder(passwordEncoder());
        return authProvider;
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    CorsConfigurationSource corsConfigurationSource() {
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();

        CorsConfiguration uploadsConfiguration = new CorsConfiguration();
        uploadsConfiguration.setAllowedOrigins(List.of(Constantes.CORS_ORIGIN_LOCALHOST_4200));
        uploadsConfiguration.setAllowedMethods(List.of(CORS_METHOD_POST, CORS_METHOD_OPTIONS));
        uploadsConfiguration.setAllowedHeaders(List.of(
                Constantes.HEADER_AUTHORIZATION,
                CORS_HEADER_CONTENT_TYPE,
                CORS_HEADER_ACCEPT));
        uploadsConfiguration.setAllowCredentials(true);
        uploadsConfiguration.setMaxAge(3600L);
        source.registerCorsConfiguration(API_UPLOADS_FILE, uploadsConfiguration);
        source.registerCorsConfiguration(API_UPLOADS_MEDIA, uploadsConfiguration);
        source.registerCorsConfiguration(API_UPLOADS_AUDIO, uploadsConfiguration);

        CorsConfiguration defaultConfiguration = new CorsConfiguration();
        defaultConfiguration.setAllowedOrigins(Arrays.asList(Constantes.CORS_ORIGIN_LOCALHOST_4200, Constantes.CORS_ORIGIN_127_4200));
        defaultConfiguration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH", "HEAD"));
        defaultConfiguration.setAllowedHeaders(Arrays.asList(Constantes.CORS_ANY_ORIGIN));
        defaultConfiguration.setAllowCredentials(true);
        defaultConfiguration.setMaxAge(3600L);
        source.registerCorsConfiguration(MATCH_ALL, defaultConfiguration);

        return source;
    }
}
